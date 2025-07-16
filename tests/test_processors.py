import os
import sys
import types
import pytest

# Provide dummy modules so tests run without external dependencies
class DummyOpenAI:
    class Chat:
        class Completions:
            def create(self, **kwargs):
                return types.SimpleNamespace(choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=''))])
        def __init__(self):
            self.completions = self.Completions()
    def __init__(self, *a, **k):
        self.chat = self.Chat()

dummy_openai = types.SimpleNamespace(OpenAI=DummyOpenAI)
sys.modules.setdefault('openai', dummy_openai)
dummy_requests = types.SimpleNamespace(request=lambda *a, **k: None)
sys.modules.setdefault('requests', dummy_requests)
sys.modules.setdefault('dotenv', types.SimpleNamespace(load_dotenv=lambda **k: None))
sys.modules.setdefault('colorlog', types.ModuleType('colorlog'))
# Provide a minimal logger module used by the processors
dummy_logger = types.SimpleNamespace(info=lambda *a, **k: None,
                                     error=lambda *a, **k: None,
                                     warning=lambda *a, **k: None)
sys.modules.setdefault('src.utils.logger', types.SimpleNamespace(logger=dummy_logger))
sys.path.insert(0, os.path.abspath('.'))

from src.llm.symbol import SymbolProcessor
from src.llm.translate import TranslateProcessor

class DummyResponse:
    def json(self):
        return {}

def test_symbol_add_symbol_error(monkeypatch):
    sp = SymbolProcessor()
    def fake_create(**kwargs):
        raise Exception('boom')
    monkeypatch.setattr(sp.client.chat.completions, 'create', fake_create)
    with pytest.raises(RuntimeError, match='标点添加失败'):
        sp.add_symbol('test')

def test_translate_error(monkeypatch):
    tp = TranslateProcessor()
    def fake_request(*args, **kwargs):
        raise Exception('boom')
    monkeypatch.setattr('requests.request', fake_request)
    with pytest.raises(RuntimeError, match='翻译失败'):
        tp.translate('hello')

