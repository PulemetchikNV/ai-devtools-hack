import { logger } from '../../../utils/logger.js';
import { SuggestTestsInputSchema, suggestTestsJsonSchema } from '../schemas.js';

type TestSuggestion = {
  type: 'unit' | 'integration' | 'e2e' | 'migration' | 'perf' | 'security' | 'manual';
  title: string;
  reason?: string;
};

type SuggestTestsResponse = {
  summary: string[];
  tests: TestSuggestion[];
  stats: {
    files: number;
    additions: number;
    deletions: number;
  };
  warnings?: string[];
};

function buildPatchFromChanges(changes: Array<{
  old_path: string;
  new_path: string;
  diff: string;
  new_file?: boolean;
  renamed_file?: boolean;
  deleted_file?: boolean;
}>): string {
  return changes.map((change) => {
    const header = [
      `diff --git a/${change.old_path} b/${change.new_path}`,
      change.new_file ? 'new file mode 100644' : '',
      change.deleted_file ? 'deleted file mode 100644' : '',
      `--- a/${change.old_path}`,
      `+++ b/${change.new_path}`,
    ].filter(Boolean).join('\n');
    return `${header}\n${change.diff}`;
  }).join('\n');
}

function collectStats(patch: string) {
  const additions = (patch.match(/^(\+)(?!\+\+|\+\+\+)/gm) || []).length;
  const deletions = (patch.match(/^(\-)(?!--|---)/gm) || []).length;
  const files = (patch.match(/^diff --git /gm) || []).length || (patch ? 1 : 0);
  return { files, additions, deletions };
}

function deriveTests(patch: string): TestSuggestion[] {
  const tests: TestSuggestion[] = [];
  const lower = patch.toLowerCase();

  const add = (suggestion: TestSuggestion) => {
    if (!tests.some(t => t.title === suggestion.title)) {
      tests.push(suggestion);
    }
  };

  // Generic defaults
  add({ type: 'unit', title: 'Запустить unit-тесты по затронутым модулям' });
  add({ type: 'integration', title: 'Интеграционные сценарии по ключевым API/контрактам' });

  // Heuristics
  if (lower.includes('migration') || lower.includes('prisma/migrations') || lower.includes('schema.prisma')) {
    add({ type: 'migration', title: 'Прогнать миграции и откат', reason: 'Обнаружены изменения в миграциях/схеме' });
    add({ type: 'integration', title: 'Проверить совместимость БД со старым кодом', reason: 'Изменения схемы' });
  }

  if (lower.includes('package.json') || lower.includes('package-lock.json') || lower.includes('requirements.txt')) {
    add({ type: 'integration', title: 'Собрать приложение после обновления зависимостей', reason: 'Обновление зависимостей' });
  }

  if (lower.includes('router') || lower.includes('route') || lower.includes('controller') || lower.includes('api/')) {
    add({ type: 'e2e', title: 'Смоук e2e по затронутым endpoint', reason: 'Изменения API/маршрутов' });
  }

  if (lower.includes('auth') || lower.includes('jwt') || lower.includes('permission') || lower.includes('acl')) {
    add({ type: 'security', title: 'Проверить авторизацию/права', reason: 'Изменения в auth/permission' });
  }

  if (lower.includes('queue') || lower.includes('worker') || lower.includes('cron')) {
    add({ type: 'integration', title: 'Проверить отложенные задачи/джобы', reason: 'Изменения фоновых задач' });
  }

  if (lower.includes('docker') || lower.includes('compose') || lower.includes('k8s') || lower.includes('helm')) {
    add({ type: 'manual', title: 'Смоук деплой/контейнеры', reason: 'Инфраструктурные изменения' });
  }

  if (lower.includes('performance') || lower.includes('benchmark') || lower.includes('cache')) {
    add({ type: 'perf', title: 'Прогнать perf/нагрузочные тесты на измененных путях', reason: 'Оптимизация/кэш' });
  }

  return tests;
}

export const suggestTestsTool = {
  name: 'suggest_tests',
  description: 'Suggest a test checklist based on a unified diff or GitLab changes array.',
  inputSchema: suggestTestsJsonSchema,

  async handler(args: unknown) {
    const parsed = SuggestTestsInputSchema.safeParse(args);

    if (!parsed.success) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'VALIDATION_ERROR',
            message: parsed.error.message,
          }, null, 2),
        }],
        isError: true,
      };
    }

    const { patch: rawPatch, changes, project_path, mr_iid, max_items } = parsed.data;

    if (!rawPatch && (!changes || changes.length === 0)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'NO_DIFF',
            message: 'Provide patch (unified diff) or changes array.',
          }, null, 2),
        }],
        isError: true,
      };
    }

    const patch = rawPatch || buildPatchFromChanges(changes || []);
    const stats = collectStats(patch);
    const warnings: string[] = [];

    if (stats.files > 50) {
      warnings.push('Large diff detected; suggestions may be incomplete.');
    }

    const tests = deriveTests(patch).slice(0, max_items ?? 20);

    const response: SuggestTestsResponse = {
      summary: [
        `Изменения: файлов ${stats.files}, +${stats.additions}/-${stats.deletions}`,
        project_path ? `Проект: ${project_path}` : 'Проект не указан',
        mr_iid ? `MR !${mr_iid}` : 'MR не указан',
      ].filter(Boolean),
      tests,
      stats,
      warnings: warnings.length ? warnings : undefined,
    };

    logger.info('SuggestTests', `Processed patch for tests: files=${stats.files}, +${stats.additions}, -${stats.deletions}`);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(response, null, 2),
      }],
    };
  },
};
