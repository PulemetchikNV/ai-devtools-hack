import { logger } from '../../../utils/logger.js';
import { ReviewPatchInputSchema, reviewPatchJsonSchema } from '../schemas.js';

type ReviewPatchResponse = {
  summary: string[];
  findings: Array<{
    severity: 'blocker' | 'high' | 'medium' | 'low';
    file?: string;
    line?: number;
    title: string;
    details?: string;
    suggestion?: string;
    category?: string;
  }>;
  tests: string[];
  risks: string[];
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

export const reviewPatchTool = {
  name: 'review_patch',
  description: 'Perform lightweight code-review on a unified diff or GitLab changes array. Returns structured findings, risks, and test checklist.',
  inputSchema: reviewPatchJsonSchema,

  async handler(args: unknown) {
    const parsed = ReviewPatchInputSchema.safeParse(args);
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

    const { patch: rawPatch, changes, project_path, mr_iid, max_findings } = parsed.data;

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
      warnings.push('Large diff detected; findings truncated.');
    }

    // Placeholder analysis – to be replaced with real LLM-backed review.
    const response: ReviewPatchResponse = {
      summary: [
        `Изменения: файлов ${stats.files}, +${stats.additions}/-${stats.deletions}`,
        project_path ? `Проект: ${project_path}` : 'Проект не указан',
        mr_iid ? `MR !${mr_iid}` : 'MR не указан',
      ].filter(Boolean),
      findings: [],
      tests: [
        'Запустить unit-тесты по затронутым модулям',
        'Проверить интеграционные сценарии, если менялись API/контракты',
      ].slice(0, max_findings ?? 50),
      risks: [
        'Автоматический анализ сейчас в режиме заглушки — проведите ручную проверку',
      ],
      stats,
      warnings: warnings.length ? warnings : undefined,
    };

    logger.info('ReviewPatch', `Processed patch: files=${stats.files}, +${stats.additions}, -${stats.deletions}`);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(response, null, 2),
      }],
    };
  },
};
