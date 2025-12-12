import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from src.utils import split_long_message  # noqa: E402
from src.a2a_client import AgentClient  # noqa: E402


class UtilsTests(unittest.TestCase):
    def test_split_long_message_preserves_short(self):
        text = "hello"
        chunks = split_long_message(text, max_length=10)
        self.assertEqual(chunks, [text])

    def test_split_long_message_splits_by_paragraphs(self):
        text = "a" * 5 + "\n\n" + "b" * 15
        chunks = split_long_message(text, max_length=10)
        # Функция разрежет: "aaaaa", затем слишком длинный параграф на две части
        self.assertEqual(len(chunks), 3)
        self.assertTrue(all(len(c) <= 10 for c in chunks))
        self.assertEqual(chunks[0], "a" * 5)

    def test_split_long_message_hard_cut_sentences(self):
        sentence = "x" * 25
        chunks = split_long_message(sentence, max_length=10)
        self.assertTrue(all(len(c) <= 10 for c in chunks))
        self.assertGreater(len(chunks), 2)  # было разрезано грубо

    def test_format_user_info_builds_bracketed_string(self):
        client = AgentClient()
        info = {
            "first_name": "Ivan",
            "last_name": "Petrov",
            "username": "ivanp",
        }
        result = client._format_user_info(info)
        self.assertIn("Имя: Ivan", result)
        self.assertIn("Фамилия: Petrov", result)
        self.assertIn("@ivanp", result)
        self.assertTrue(result.startswith("["))
        self.assertTrue(result.endswith("]"))

    def test_parts_to_text_filters_empty(self):
        class DummyRoot:
            def __init__(self, text):
                self.text = text

        class DummyPart:
            def __init__(self, text):
                self.root = DummyRoot(text)

        client = AgentClient()
        parts = [DummyPart("hi"), DummyPart(""), DummyPart("bye")]
        result = client.parts_to_text(parts)
        self.assertEqual(result, "hi\nbye")


if __name__ == "__main__":
    unittest.main()
