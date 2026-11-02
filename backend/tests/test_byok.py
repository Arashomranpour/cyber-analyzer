"""Offline tests: the web API must never fall back to a server-side Groq key."""

import pytest
from fastapi.testclient import TestClient

import server


@pytest.fixture()
def client(monkeypatch):
    # An env key must NOT bypass the gate.
    monkeypatch.setenv("GROQ_API_KEY", "gsk_should_not_be_used")
    return TestClient(server.app)


def test_analyze_requires_key(client):
    r = client.post("/api/analyze", json={"code": "print(1)"})
    assert r.status_code == 401


def test_analyze_rejects_malformed_key(client):
    r = client.post("/api/analyze", json={"code": "print(1)"}, headers={"X-Groq-Api-Key": "nope"})
    assert r.status_code == 401
    assert "gsk_" in r.json()["detail"]


def test_validate_requires_key(client):
    assert client.post("/api/validate-key").status_code == 401


def test_empty_code_rejected(client):
    r = client.post("/api/analyze", json={"code": "  "}, headers={"X-Groq-Api-Key": "gsk_x"})
    assert r.status_code == 400


def test_oversized_code_rejected(client):
    code = "x" * (server.MAX_CODE_CHARS + 1)
    r = client.post("/api/analyze", json={"code": code}, headers={"X-Groq-Api-Key": "gsk_x"})
    assert r.status_code == 413


def test_health(client):
    assert client.get("/health").status_code == 200
