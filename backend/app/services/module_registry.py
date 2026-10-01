from dataclasses import asdict, dataclass

from fastapi import HTTPException


IMPLEMENTED = "implemented"
PARTIAL = "partial"
NOT_IMPLEMENTED = "not_implemented"


@dataclass(frozen=True)
class ModuleDefinition:
    key: str
    name: str
    description: str
    status: str
    order: int
    default_enabled: bool = False
    core: bool = False
    configurable: bool = True
    dependencies: tuple[str, ...] = ()

    @property
    def available(self) -> bool:
        return self.status != NOT_IMPLEMENTED and (self.core or self.configurable)

    def as_dict(self) -> dict:
        value = asdict(self)
        value["dependencies"] = list(self.dependencies)
        value["available"] = self.available
        return value


# Backend source of truth. Partial modules are configurable only when their
# current behavior is backed by tenant-aware data or safely scoped local state.
MODULE_REGISTRY = (
    ModuleDefinition("dashboard", "Dashboard", "Visão geral do Personal", IMPLEMENTED, 10, True, True, False),
    ModuleDefinition("students", "Alunos", "Gerenciamento de alunos", IMPLEMENTED, 20, True),
    ModuleDefinition("workouts", "Treinos", "Criação e acompanhamento de treinos", IMPLEMENTED, 30, True),
    ModuleDefinition("progress", "Progresso", "Evolução baseada nos treinos concluídos", IMPLEMENTED, 40, True, dependencies=("workouts",)),
    ModuleDefinition("calendar", "Agenda", "Calendário, treinos e compromissos", IMPLEMENTED, 50, True),
    ModuleDefinition("coach", "Coach IA", "Sugestões inteligentes para o Personal", PARTIAL, 60, True, dependencies=("students", "workouts")),
    ModuleDefinition("about", "Sobre o Personal", "Identidade e informações públicas do Personal", PARTIAL, 70, True),
    ModuleDefinition("settings", "Configurações e branding", "Identidade visual e preferências essenciais", IMPLEMENTED, 80, True, True, False),
    ModuleDefinition("diet", "Dietas", "Planejamento alimentar", NOT_IMPLEMENTED, 90, False, False, False),
    ModuleDefinition("assessments", "Avaliações", "Avaliações físicas e registros históricos", IMPLEMENTED, 100, False),
    ModuleDefinition("finance", "Financeiro", "Gestão financeira do Personal", NOT_IMPLEMENTED, 110, False, False, False),
    ModuleDefinition("payments", "Pagamentos", "Pagamentos do aluno", NOT_IMPLEMENTED, 120, False, False, False),
    ModuleDefinition("messages", "Mensagens", "Comunicação entre Personal e aluno", NOT_IMPLEMENTED, 140, False, False, False),
    ModuleDefinition("reports", "Relatórios", "Relatórios consolidados", NOT_IMPLEMENTED, 150, False, False, False),
    ModuleDefinition("files", "Arquivos", "Documentos compartilhados", NOT_IMPLEMENTED, 160, False, False, False),
)

MODULES_BY_KEY = {module.key: module for module in MODULE_REGISTRY}
MODULE_KEYS = frozenset(MODULES_BY_KEY)
DEFAULT_MODULES = {module.key: module.default_enabled for module in MODULE_REGISTRY}


def module_catalog() -> list[dict]:
    return [module.as_dict() for module in MODULE_REGISTRY]


def resolve_modules(configured: dict | None) -> dict[str, bool]:
    requested = {**DEFAULT_MODULES, **(configured or {})}
    resolved = {}
    for module in MODULE_REGISTRY:
        if module.core:
            resolved[module.key] = True
        elif not module.available:
            resolved[module.key] = False
        else:
            resolved[module.key] = requested.get(module.key) is True
    for module in MODULE_REGISTRY:
        if resolved[module.key] and any(not resolved[dependency] for dependency in module.dependencies):
            resolved[module.key] = False
    return resolved


def validate_module_configuration(configured: dict | None) -> dict[str, bool]:
    configured = configured or {}
    unknown = set(configured) - MODULE_KEYS
    if unknown or any(type(value) is not bool for value in configured.values()):
        raise ValueError("Configuração de módulos inválida")
    requested = {**DEFAULT_MODULES, **configured}
    for module in MODULE_REGISTRY:
        if module.core or not module.available or requested.get(module.key) is not True:
            continue
        missing = [dependency for dependency in module.dependencies if requested.get(dependency) is not True]
        if missing:
            dependency_names = ", ".join(MODULES_BY_KEY[key].name for key in missing)
            raise ValueError(f"{module.name} requer: {dependency_names}")
    return resolve_modules(configured)


def module_disabled_error(module_key: str) -> HTTPException:
    return HTTPException(
        status_code=403,
        detail={"code": "module_disabled", "module": module_key},
    )
