import uuid
from types import SimpleNamespace

from app.services.coach.data_resolver import CoachDataResolver


def exercise_link(name):
    return SimpleNamespace(
        id=uuid.uuid4(), workout_id=uuid.uuid4(), exercise_id=uuid.uuid4(),
        exercise=SimpleNamespace(name=name),
    )


def resolver_with(*links):
    resolver = CoachDataResolver.__new__(CoachDataResolver)
    resolver.workouts = lambda: [SimpleNamespace(exercises=list(links))]
    return resolver


def test_fuzzy_exercise_resolution_is_limited_to_accessible_rows():
    supino = exercise_link("Supino reto com barra")
    agachamento = exercise_link("Agachamento livre")
    resolver = resolver_with(supino, agachamento)
    found, matches = resolver.resolve_exercise("qual carga do supnio reto", {})
    assert found.id == supino.id
    assert [row.id for row in matches] == [supino.id]


def test_pending_candidates_cannot_resolve_an_external_exercise_id():
    reto = exercise_link("Supino reto com barra")
    inclinado = exercise_link("Supino inclinado com halteres")
    external = uuid.uuid4()
    resolver = resolver_with(reto, inclinado)
    context = {"candidate_exercise_ids": [str(reto.id), str(inclinado.id), str(external)]}
    found, matches = resolver.resolve_exercise("o reto", context)
    assert found.id == reto.id
    assert external not in {row.id for row in matches}


def test_ambiguous_fuzzy_match_returns_only_authorized_candidates():
    reto = exercise_link("Supino reto com barra")
    inclinado = exercise_link("Supino inclinado com halteres")
    resolver = resolver_with(reto, inclinado)
    found, matches = resolver.resolve_exercise("supnio", {})
    assert found is None
    assert {row.id for row in matches} == {reto.id, inclinado.id}
