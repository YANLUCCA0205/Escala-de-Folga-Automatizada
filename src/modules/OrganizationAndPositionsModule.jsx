// =============================================================================
// ESTRUTURA ORGANIZACIONAL (EMPRESA, UNIDADES, SETORES, CATEGORIAS, FUNÇÕES) E
// GESTÃO COMPLETA DO QUADRO DE POSTOS E VAGAS (v8.0 — Seções 6, 16 e 19)
// =============================================================================

import { useState, useMemo } from "react";
import {
  createSequentialPositions,
  STATUS_VAGA_META,
} from "../domain/scheduleEngine.js";
import { createUniaoModuleUi } from "../theme/uniaoTheme.js";
import { Tabs, PageHeader } from "../ui/index.jsx";

export default function OrganizationAndPositionsModule({
  db,
  selectedUnitId,
  setSelectedUnitId,
  selectedYearMonth,
  initialTab = "positions",
  initialSection = null,
  onMutateDb,
}) {
  const activeReferenceDate = selectedYearMonth
    ? `${selectedYearMonth}-01`
    : new Date().toISOString().slice(0, 10);
  const [activeSection, setActiveSection] = useState(
    initialSection || (initialTab === "positions" ? "positions" : "companies")
  );
  const [filterSectorId, setFilterSectorId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchPos, setSearchPos] = useState("");

  // Modal de Edição Completa de Posto (Seção 16)
  const [editingPos, setEditingPos] = useState(null);

  // Edição da Empresa Principal (sem dados nominais reais hardcoded)
  const company = db.companies?.[0] || {
    id: "comp_default",
    legalName: "",
    tradeName: "União Supermercados",
    cnpj: "",
    active: true,
  };
  const [compLegalName, setCompLegalName] = useState(company.legalName || "");
  const [compTradeName, setCompTradeName] = useState(company.tradeName || "");
  const [compCnpj, setCompCnpj] = useState(company.cnpj || "");

  // Cadastro / Edição de Unidades (Lojas)
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitCity, setUnitCity] = useState("União");
  const [unitState, setUnitState] = useState("BR");

  // Cadastro / Edição de Setores
  const [editingSectorId, setEditingSectorId] = useState(null);
  const [newSectorName, setNewSectorName] = useState("");
  const [newSectorCode, setNewSectorCode] = useState("");
  const [newSectorMinCov, setNewSectorMinCov] = useState(2);
  const [newSectorSunCov, setNewSectorSunCov] = useState(1);

  // Cadastro / Edição de Funções
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleCatId, setNewRoleCatId] = useState("CAT_PERECIVEIS");
  const [newRoleSecId, setNewRoleSecId] = useState("SEC_ACOUGUE");
  const [newRoleCost, setNewRoleCost] = useState("");

  // Gerador Automático de Postos por Quantidade
  const [genSectorId, setGenSectorId] = useState("SEC_ACOUGUE");
  const [genRoleId, setGenRoleId] = useState("R_ACOUGUEIRO");
  const [genShiftId, setGenShiftId] = useState("SH_OP_MANHA_0640");
  const [genRuleId, setGenRuleId] = useState("RULE_5X1");
  const [genQuantity, setGenQuantity] = useState(3);
  const [genIsRateio, setGenIsRateio] = useState(false);
  const [genStatus, setGenStatus] = useState("OPEN_AUTHORIZED");
  const [genCost, setGenCost] = useState("");

  const sectorsById = useMemo(
    () => Object.fromEntries(db.sectors.map((s) => [s.id, s])),
    [db.sectors]
  );
  const rolesById = useMemo(
    () => Object.fromEntries(db.roles.map((r) => [r.id, r])),
    [db.roles]
  );
  const shiftsById = useMemo(
    () => Object.fromEntries(db.workShifts.map((s) => [s.id, s])),
    [db.workShifts]
  );
  const rulesById = useMemo(
    () => Object.fromEntries(db.scheduleRules.map((r) => [r.id, r])),
    [db.scheduleRules]
  );

  const occupantByPositionId = useMemo(() => {
    const map = {};
    db.allocations.forEach((a) => {
      if (!a.endDate || a.endDate >= activeReferenceDate) {
        const emp = db.employees.find((e) => e.id === a.employeeId);
        if (emp) map[a.workPositionId] = emp;
      }
    });
    return map;
  }, [db.allocations, db.employees, activeReferenceDate]);

  const filteredPositions = useMemo(() => {
    return db.workPositions
      .filter((p) => !selectedUnitId || p.unitId === selectedUnitId)
      .filter((p) => !filterSectorId || p.sectorId === filterSectorId)
      .filter((p) => !filterStatus || p.status === filterStatus)
      .filter((p) => {
        if (!searchPos.trim()) return true;
        const q = searchPos.toLowerCase();
        const occ = occupantByPositionId[p.id];
        return (
          p.title.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (occ && occ.fullName.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q))
        );
      });
  }, [
    db.workPositions,
    selectedUnitId,
    filterSectorId,
    filterStatus,
    searchPos,
    occupantByPositionId,
  ]);

  // Salvar Dados da Empresa
  const handleSaveCompany = (e) => {
    e.preventDefault();
    if (!compLegalName.trim()) return;
    onMutateDb({
      permission: "MANAGE_STRUCTURE",
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: "ATUALIZAR_CADASTRO_EMPRESA",
      entityType: "COMPANY",
      entityId: company.id,
      summary: `Atualizado cadastro corporativo da empresa: Razão Social "${compLegalName.trim()}", Nome Fantasia "${compTradeName.trim()}", CNPJ "${compCnpj.trim()}".`,
      updater: (draft) => {
        if (!draft.companies || draft.companies.length === 0) {
          draft.companies = [
            {
              id: "comp_default",
              legalName: compLegalName.trim(),
              tradeName: compTradeName.trim(),
              cnpj: compCnpj.trim(),
              active: true,
            },
          ];
        } else {
          draft.companies[0].legalName = compLegalName.trim();
          draft.companies[0].tradeName = compTradeName.trim();
          draft.companies[0].cnpj = compCnpj.trim();
        }
      },
    });
  };

  // Criar ou Editar Unidade (Loja)
  const handleSaveUnit = (e) => {
    e.preventDefault();
    if (!unitCode.trim() || !unitName.trim()) return;
    const cleanCode = unitCode.trim().toUpperCase();
    const cleanName = unitName.trim().toUpperCase();
    const createdUnitId = editingUnitId
      ? null
      : `UNIT_${cleanCode}_${Date.now().toString().slice(-3)}`;

    onMutateDb({
      permission: "MANAGE_STRUCTURE",
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: editingUnitId ? "EDITAR_UNIDADE" : "CRIAR_UNIDADE",
      entityType: "UNIT",
      entityId: editingUnitId || createdUnitId,
      summary: `${editingUnitId ? "Atualizada" : "Criada"} unidade operacional "${cleanName}" (${cleanCode}).`,
      updater: (draft) => {
        if (!Array.isArray(draft.units)) draft.units = [];
        if (!Array.isArray(draft.companies) || draft.companies.length === 0) {
          draft.companies = [
            {
              id: "comp_default",
              legalName: compLegalName.trim() || "União Supermercados",
              tradeName: compTradeName.trim() || "União Supermercados",
              cnpj: compCnpj.trim() || "",
              active: true,
            },
          ];
        }
        if (editingUnitId) {
          const idx = draft.units.findIndex((u) => u.id === editingUnitId);
          if (idx >= 0) {
            draft.units[idx] = {
              ...draft.units[idx],
              code: cleanCode,
              name: cleanName,
              city: unitCity.trim(),
              state: unitState.trim(),
            };
          }
        } else {
          draft.units.push({
            id: createdUnitId,
            companyId: draft.companies[0]?.id || "comp_default",
            code: cleanCode,
            name: cleanName,
            city: unitCity.trim(),
            state: unitState.trim(),
            active: true,
          });
        }
      },
    });
    if (createdUnitId && setSelectedUnitId) {
      setSelectedUnitId(createdUnitId);
    }
    setEditingUnitId(null);
    setUnitCode("");
    setUnitName("");
  };

  // Criar ou Editar Setor
  const handleSaveSector = (e) => {
    e.preventDefault();
    if (!newSectorName.trim() || !newSectorCode.trim()) return;
    const minWeekday = Number(newSectorMinCov) || 0;
    const minSun = Number(newSectorSunCov) || 0;

    onMutateDb({
      permission: "MANAGE_STRUCTURE",
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: editingSectorId ? "EDITAR_SETOR" : "CRIAR_SETOR",
      entityType: "SECTOR",
      entityId: editingSectorId || newSectorCode.trim().toUpperCase(),
      summary: `${editingSectorId ? "Atualizado" : "Criado"} setor "${newSectorName.trim().toUpperCase()}" (Mín. Dia Útil: ${minWeekday}, Mín. Dom: ${minSun}).`,
      updater: (draft) => {
        if (editingSectorId) {
          const sec = draft.sectors.find((s) => s.id === editingSectorId);
          if (sec) {
            sec.name = newSectorName.trim().toUpperCase();
            sec.code = newSectorCode.trim().toUpperCase();
            sec.minDailyCoverage = minWeekday;
          }
          let us = selectedUnitId
            ? draft.unitSectors.find(
                (u) => u.unitId === selectedUnitId && u.sectorId === editingSectorId
              )
            : null;
          if (us) {
            us.minDailyCoverage = minWeekday;
            us.minSundayCoverage = minSun;
          } else if (selectedUnitId) {
            draft.unitSectors.push({
              id: `us_${selectedUnitId}_${editingSectorId}`,
              unitId: selectedUnitId,
              sectorId: editingSectorId,
              minDailyCoverage: minWeekday,
              minSundayCoverage: minSun,
              active: true,
            });
          }
        } else {
          const secObj = {
            id: `SEC_${newSectorCode.trim().toUpperCase()}_${Date.now()}`,
            code: newSectorCode.trim().toUpperCase(),
            name: newSectorName.trim().toUpperCase(),
            displayOrder: draft.sectors.length + 1,
            minDailyCoverage: minWeekday,
            active: true,
          };
          draft.sectors.push(secObj);
          if (selectedUnitId) {
            draft.unitSectors.push({
              id: `us_${selectedUnitId}_${secObj.id}`,
              unitId: selectedUnitId,
              sectorId: secObj.id,
              minDailyCoverage: minWeekday,
              minSundayCoverage: minSun,
              active: true,
            });
          }
        }
      },
    });
    setEditingSectorId(null);
    setNewSectorName("");
    setNewSectorCode("");
  };

  // Criar ou Editar Função (Role)
  const handleSaveRole = (e) => {
    e.preventDefault();
    if (!newRoleName.trim() || !newRoleCode.trim()) return;
    const costVal = newRoleCost ? Number(newRoleCost) : null;

    onMutateDb({
      permission: "MANAGE_STRUCTURE",
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: editingRoleId ? "EDITAR_FUNCAO" : "CRIAR_FUNCAO",
      entityType: "ROLE",
      entityId: editingRoleId || newRoleCode.trim().toUpperCase(),
      summary: `${editingRoleId ? "Atualizada" : "Cadastrada"} função "${newRoleName.trim().toUpperCase()}" (${newRoleCode.trim().toUpperCase()}).`,
      updater: (draft) => {
        if (editingRoleId) {
          const r = draft.roles.find((x) => x.id === editingRoleId);
          if (r) {
            r.name = newRoleName.trim().toUpperCase();
            r.code = newRoleCode.trim().toUpperCase();
            r.categoryId = newRoleCatId;
            r.defaultSectorId = newRoleSecId;
            r.projectedMonthlyCost = costVal;
          }
        } else {
          draft.roles.push({
            id: `R_${newRoleCode.trim().toUpperCase()}_${Date.now()}`,
            categoryId: newRoleCatId,
            defaultSectorId: newRoleSecId,
            code: newRoleCode.trim().toUpperCase(),
            name: newRoleName.trim().toUpperCase(),
            hierarchyRank: 20,
            projectedMonthlyCost: costVal,
            active: true,
          });
        }
      },
    });
    setEditingRoleId(null);
    setNewRoleName("");
    setNewRoleCode("");
    setNewRoleCost("");
  };

  // Geração automática de N postos numerados
  const handleCreateBatchPositions = (e) => {
    e.preventDefault();
    if (!selectedUnitId) return;
    const role = rolesById[genRoleId];
    if (!role) return;

    const existingForRole = db.workPositions.filter(
      (p) => p.unitId === selectedUnitId && p.roleId === genRoleId && !p.isSharedRateio
    );
    const startNum = existingForRole.length + 1;
    const costVal = genCost ? Number(genCost) : null;

    const newPositions = createSequentialPositions({
      unitId: selectedUnitId,
      sectorId: genSectorId,
      role,
      quantity: Math.max(1, Number(genQuantity) || 1),
      startNumber: startNum,
      defaultShiftId: genShiftId,
      defaultRuleId: genRuleId,
      isSharedRateio: genIsRateio,
      initialStatus: genStatus,
      estimatedMonthlyCost: costVal,
    });

    onMutateDb({
      permission: "CREATE_POSITIONS",
      module: "QUADRO_DE_VAGAS",
      action: "GERAR_POSTOS_SEQUENCIAIS",
      entityType: "WORK_POSITION",
      entityId: newPositions.map((p) => p.code).join(","),
      summary: `Criados automaticamente ${newPositions.length} posto(s) para a função ${role.name} (${newPositions[0].title} até ${newPositions[newPositions.length - 1].title}) na unidade ${selectedUnitId}.`,
      updater: (draft) => {
        draft.workPositions.push(...newPositions);
      },
    });
  };

  // Salvar Edição Completa de um Posto de Trabalho (Seção 16)
  const handleSaveEditedPosition = (e) => {
    e.preventDefault();
    if (!editingPos) return;

    onMutateDb({
      permission: "CREATE_POSITIONS",
      module: "QUADRO_DE_VAGAS",
      action: "EDITAR_POSTO_TRABALHO",
      entityType: "WORK_POSITION",
      entityId: editingPos.id,
      summary: `Atualizado posto [${editingPos.code}] "${editingPos.title}" (Setor: ${sectorsById[editingPos.sectorId]?.name}, Status: ${editingPos.status}).`,
      updater: (draft) => {
        const idx = draft.workPositions.findIndex((p) => p.id === editingPos.id);
        if (idx >= 0) {
          draft.workPositions[idx] = {
            ...draft.workPositions[idx],
            ...editingPos,
            estimatedMonthlyCost:
              editingPos.estimatedMonthlyCost === "" || editingPos.estimatedMonthlyCost === null
                ? null
                : Number(editingPos.estimatedMonthlyCost),
          };
        }
      },
    });
    setEditingPos(null);
  };

  // Excluir Unidade (Loja)
  const handleDeleteUnit = (unit) => {
    if (!unit || (db.units || []).length <= 1) return;
    const nextActiveUnit = (db.units || []).find((u) => u.id !== unit.id);

    onMutateDb({
      permission: "MANAGE_STRUCTURE",
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: "EXCLUIR_UNIDADE",
      entityType: "UNIT",
      entityId: unit.id,
      unitId: unit.id,
      summary: `Excluída unidade operacional "${unit.name}" (${unit.code}) e seus vínculos locais.`,
      updater: (draft) => {
        draft.units = (draft.units || []).filter((u) => u.id !== unit.id);
        draft.unitSectors = (draft.unitSectors || []).filter((us) => us.unitId !== unit.id);
        draft.workPositions = (draft.workPositions || []).filter((p) => p.unitId !== unit.id);
        draft.allocations = (draft.allocations || []).filter((a) => a.unitId !== unit.id);
        draft.marketCalendarDays = (draft.marketCalendarDays || []).filter(
          (c) => c.unitId !== unit.id
        );
        draft.monthlySchedules = (draft.monthlySchedules || []).filter(
          (ms) => ms.unitId !== unit.id
        );
      },
    });

    if (selectedUnitId === unit.id && nextActiveUnit && setSelectedUnitId) {
      setSelectedUnitId(nextActiveUnit.id);
    }
    if (editingUnitId === unit.id) {
      setEditingUnitId(null);
      setUnitCode("");
      setUnitName("");
    }
  };

  // Excluir Setor Operacional
  const handleDeleteSector = (sec) => {
    if (!sec) return;
    onMutateDb({
      permission: "MANAGE_STRUCTURE",
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: "EXCLUIR_SETOR",
      entityType: "SECTOR",
      entityId: sec.id,
      summary: `Excluído setor operacional "${sec.name}" (${sec.code}).`,
      updater: (draft) => {
        const posIdsInSec = new Set(
          (draft.workPositions || []).filter((p) => p.sectorId === sec.id).map((p) => p.id)
        );
        draft.sectors = (draft.sectors || []).filter((s) => s.id !== sec.id);
        draft.unitSectors = (draft.unitSectors || []).filter((us) => us.sectorId !== sec.id);
        draft.workPositions = (draft.workPositions || []).filter((p) => p.sectorId !== sec.id);
        draft.allocations = (draft.allocations || []).filter(
          (a) => a.sectorId !== sec.id && !posIdsInSec.has(a.workPositionId)
        );
      },
    });
    if (editingSectorId === sec.id) {
      setEditingSectorId(null);
      setNewSectorCode("");
      setNewSectorName("");
    }
  };

  // Excluir Função / Cargo
  const handleDeleteRole = (role) => {
    if (!role) return;
    onMutateDb({
      permission: "MANAGE_STRUCTURE",
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: "EXCLUIR_FUNCAO",
      entityType: "ROLE",
      entityId: role.id,
      summary: `Excluída função/cargo "${role.name}" (${role.code}).`,
      updater: (draft) => {
        const posIdsInRole = new Set(
          (draft.workPositions || []).filter((p) => p.roleId === role.id).map((p) => p.id)
        );
        draft.roles = (draft.roles || []).filter((r) => r.id !== role.id);
        draft.workPositions = (draft.workPositions || []).filter((p) => p.roleId !== role.id);
        draft.allocations = (draft.allocations || []).filter(
          (a) => a.roleId !== role.id && !posIdsInRole.has(a.workPositionId)
        );
      },
    });
    if (editingRoleId === role.id) {
      setEditingRoleId(null);
      setNewRoleCode("");
      setNewRoleName("");
    }
  };

  // Excluir Posto de Trabalho / Vaga
  const handleDeletePosition = (pos) => {
    if (!pos) return;
    onMutateDb({
      permission: "CREATE_POSITIONS",
      module: "QUADRO_DE_VAGAS",
      action: "EXCLUIR_POSTO_TRABALHO",
      entityType: "WORK_POSITION",
      entityId: pos.id,
      unitId: pos.unitId,
      summary: `Excluído posto de trabalho [${pos.code}] "${pos.title}" da unidade ${pos.unitId}.`,
      updater: (draft) => {
        draft.workPositions = (draft.workPositions || []).filter((p) => p.id !== pos.id);
        draft.allocations = (draft.allocations || []).filter(
          (a) => a.workPositionId !== pos.id
        );
        Object.keys(draft.dailyEntriesByMonth || {}).forEach((ym) => {
          draft.dailyEntriesByMonth[ym] = (draft.dailyEntriesByMonth[ym] || []).filter(
            (e) => e.workPositionId !== pos.id
          );
        });
      },
    });
    if (editingPos?.id === pos.id) {
      setEditingPos(null);
    }
  };

  const sectionTabs = [
    { id: "companies", label: "Empresas", icon: "building" },
    { id: "units", label: "Unidades", icon: "store", badge: db.units.length },
    { id: "sectors", label: "Setores", icon: "layers", badge: db.sectors.length },
    { id: "roles", label: "Funções e cargos", icon: "briefcase", badge: db.roles.length },
    {
      id: "positions",
      label: "Quadro de postos e vagas",
      icon: "people",
      badge: filteredPositions.length,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PageHeader
        title={
          activeSection === "positions"
            ? "Quadro de postos e vagas"
            : "Estrutura organizacional"
        }
        subtitle="Gestão de empresas, filiais, setores operacionais, catálogo de funções e dimensionamento de vagas."
      />

      <Tabs
        items={sectionTabs}
        activeId={activeSection}
        onChange={setActiveSection}
        ariaLabel="Seções da estrutura organizacional"
      />

      {activeSection === "companies" && (
        <div style={{ ...ui.card, maxWidth: 680 }}>
          <div style={ui.cardTitle}>Dados cadastrais da empresa</div>
          <form
            onSubmit={handleSaveCompany}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div>
              <label style={ui.label}>Razão Social Oficial *</label>
              <input
                type="text"
                value={compLegalName}
                onChange={(e) => setCompLegalName(e.target.value)}
                style={ui.input}
                required
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
              <div>
                <label style={ui.label}>Nome Fantasia / Grupo</label>
                <input
                  type="text"
                  value={compTradeName}
                  onChange={(e) => setCompTradeName(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>CNPJ</label>
                <input
                  type="text"
                  value={compCnpj}
                  onChange={(e) => setCompCnpj(e.target.value)}
                  style={ui.input}
                />
              </div>
            </div>
            <div>
              <button type="submit" style={ui.btnPrimary}>
                Salvar cadastro da empresa
              </button>
            </div>
          </form>
        </div>
      )}

      {activeSection === "units" && (
        <div style={ui.card}>
          <div style={ui.cardTitle}>Unidades operacionais (Filiais)</div>
          <form
            onSubmit={handleSaveUnit}
            style={{
              display: "grid",
              gridTemplateColumns: "0.8fr 1.4fr 1fr auto",
              gap: 8,
              alignItems: "end",
              marginBottom: 14,
            }}
          >
            <div>
              <label style={ui.label}>Código</label>
              <input
                placeholder="Ex: LJ04"
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Nome da Unidade</label>
              <input
                placeholder="Ex: LOJA 04"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Cidade</label>
              <input
                value={unitCity}
                onChange={(e) => setUnitCity(e.target.value)}
                style={ui.input}
              />
            </div>
            <button type="submit" style={ui.btnPrimary}>
              {editingUnitId ? "Salvar unidade" : "Adicionar unidade"}
            </button>
          </form>

          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Código</th>
                <th style={ui.th}>Unidade</th>
                <th style={ui.th}>Cidade / UF</th>
                <th style={{ ...ui.th, textAlign: "center" }}>Postos</th>
                <th style={{ ...ui.th, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {db.units.map((u) => {
                const posCount = db.workPositions.filter((p) => p.unitId === u.id).length;
                return (
                  <tr key={u.id}>
                    <td style={{ ...ui.td, fontWeight: 700 }}>{u.code}</td>
                    <td style={{ ...ui.td, fontWeight: 600 }}>
                      {u.name}{" "}
                      {u.id === selectedUnitId && (
                        <span style={{ fontSize: 12, color: "var(--erp-brand-blue)" }}>
                          (Ativa)
                        </span>
                      )}
                    </td>
                    <td style={ui.td}>
                      {u.city || "—"} {u.state ? `· ${u.state}` : ""}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center" }}>{posCount}</td>
                    <td style={{ ...ui.td, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUnitId(u.id);
                            setUnitCode(u.code);
                            setUnitName(u.name);
                            setUnitCity(u.city || "");
                            setUnitState(u.state || "MG");
                          }}
                          style={ui.btnSmall}
                        >
                          Editar
                        </button>
                        {db.units.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUnit(u)}
                            style={{ ...ui.btnSmall, color: "var(--erp-danger)" }}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeSection === "sectors" && (
        <div style={ui.card}>
          <div style={ui.cardTitle}>
            Setores operacionais e cobertura mínima ({selectedUnitId})
          </div>
          <form
            onSubmit={handleSaveSector}
            style={{
              display: "grid",
              gridTemplateColumns: "0.9fr 1.4fr 0.7fr 0.7fr auto",
              gap: 8,
              alignItems: "end",
              marginBottom: 14,
            }}
          >
            <div>
              <label style={ui.label}>Código</label>
              <input
                type="text"
                placeholder="PADARIA"
                value={newSectorCode}
                onChange={(e) => setNewSectorCode(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Nome do Setor</label>
              <input
                type="text"
                placeholder="Nome do Setor"
                value={newSectorName}
                onChange={(e) => setNewSectorName(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Mín. Útil</label>
              <input
                type="number"
                min={0}
                max={30}
                value={newSectorMinCov}
                onChange={(e) => setNewSectorMinCov(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Mín. Dom</label>
              <input
                type="number"
                min={0}
                max={30}
                value={newSectorSunCov}
                onChange={(e) => setNewSectorSunCov(e.target.value)}
                style={ui.input}
              />
            </div>
            <button type="submit" style={ui.btnPrimary}>
              {editingSectorId ? "Salvar setor" : "Adicionar setor"}
            </button>
          </form>

          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Setor</th>
                <th style={{ ...ui.th, textAlign: "center" }}>Mín. Dia Útil</th>
                <th style={{ ...ui.th, textAlign: "center" }}>Mín. Domingo</th>
                <th style={{ ...ui.th, textAlign: "center" }}>Postos ({selectedUnitId})</th>
                <th style={{ ...ui.th, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {db.sectors.map((s) => {
                const us = (db.unitSectors || []).find(
                  (u) => u.unitId === selectedUnitId && u.sectorId === s.id
                );
                const minW = us?.minDailyCoverage ?? s.minDailyCoverage ?? 1;
                const minSun = us?.minSundayCoverage ?? Math.floor(minW * 0.6);
                const count = db.workPositions.filter(
                  (p) => p.unitId === selectedUnitId && p.sectorId === s.id
                ).length;
                return (
                  <tr key={s.id}>
                    <td style={{ ...ui.td, fontWeight: 600 }}>{s.name}</td>
                    <td style={{ ...ui.td, textAlign: "center" }}>{minW}</td>
                    <td style={{ ...ui.td, textAlign: "center" }}>{minSun}</td>
                    <td style={{ ...ui.td, textAlign: "center" }}>{count}</td>
                    <td style={{ ...ui.td, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSectorId(s.id);
                            setNewSectorCode(s.code);
                            setNewSectorName(s.name);
                            setNewSectorMinCov(minW);
                            setNewSectorSunCov(minSun);
                          }}
                          style={ui.btnSmall}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSector(s)}
                          style={{ ...ui.btnSmall, color: "var(--erp-danger)" }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeSection === "roles" && (
        <div style={ui.card}>
          <div style={ui.cardTitle}>Catálogo de funções e cargos</div>
          <form
            onSubmit={handleSaveRole}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 8,
              alignItems: "end",
              marginBottom: 14,
            }}
          >
            <div>
              <label style={ui.label}>Código</label>
              <input
                type="text"
                placeholder="Ex: PADEIRO"
                value={newRoleCode}
                onChange={(e) => setNewRoleCode(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Nome da Função</label>
              <input
                type="text"
                placeholder="Nome da Função"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Categoria</label>
              <select
                value={newRoleCatId}
                onChange={(e) => setNewRoleCatId(e.target.value)}
                style={ui.select}
              >
                {db.functionalCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={ui.label}>Setor Padrão</label>
              <select
                value={newRoleSecId}
                onChange={(e) => setNewRoleSecId(e.target.value)}
                style={ui.select}
              >
                {db.sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={ui.label}>Custo Projetado (R$)</label>
              <input
                type="number"
                placeholder="Opcional"
                value={newRoleCost}
                onChange={(e) => setNewRoleCost(e.target.value)}
                style={ui.input}
              />
            </div>
            <button type="submit" style={ui.btnPrimary}>
              {editingRoleId ? "Salvar função" : "Adicionar função"}
            </button>
          </form>

          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Função / Cargo</th>
                <th style={ui.th}>Setor Padrão</th>
                <th style={{ ...ui.th, textAlign: "center" }}>Postos ({selectedUnitId})</th>
                <th style={{ ...ui.th, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {db.roles.map((r) => {
                const count = db.workPositions.filter(
                  (p) => p.unitId === selectedUnitId && p.roleId === r.id
                ).length;
                return (
                  <tr key={r.id}>
                    <td style={{ ...ui.td, fontWeight: 600 }}>{r.name}</td>
                    <td style={{ ...ui.td, color: "var(--erp-ink-secondary)" }}>
                      {sectorsById[r.defaultSectorId]?.name || "—"}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center" }}>{count}</td>
                    <td style={{ ...ui.td, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRoleId(r.id);
                            setNewRoleCode(r.code);
                            setNewRoleName(r.name);
                            setNewRoleCatId(r.categoryId || "CAT_PERECIVEIS");
                            setNewRoleSecId(r.defaultSectorId || "SEC_ACOUGUE");
                            setNewRoleCost(r.projectedMonthlyCost ?? "");
                          }}
                          style={ui.btnSmall}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRole(r)}
                          style={{ ...ui.btnSmall, color: "var(--erp-danger)" }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeSection === "positions" && !selectedUnitId && (
        <div style={ui.card}>
          <div style={ui.cardTitle}>Quadro de postos e vagas</div>
          <div style={{ fontSize: 13, color: "var(--erp-ink-secondary)", lineHeight: 1.5 }}>
            Cadastre primeiro ao menos uma unidade operacional na aba{" "}
            <button
              type="button"
              onClick={() => setActiveSection("units")}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                color: "var(--erp-brand-blue)",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Unidades
            </button>{" "}
            para dimensionar o quadro de postos e vagas da filial.
          </div>
        </div>
      )}

      {activeSection === "positions" && Boolean(selectedUnitId) && (
        <>
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              Criação de postos de trabalho em lote ({selectedUnitId})
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Ao informar a Função e a Quantidade (ex.: <code>Açougueiro</code> · <code>3</code>), o
              sistema gera postos individuais com numeração sequencial automática na unidade ativa (
              <strong>{selectedUnitId}</strong>).
            </div>

            <form
              onSubmit={handleCreateBatchPositions}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <label style={ui.label}>Setor</label>
                <select
                  value={genSectorId}
                  onChange={(e) => setGenSectorId(e.target.value)}
                  style={ui.select}
                >
                  {db.sectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={ui.label}>Função</label>
                <select
                  value={genRoleId}
                  onChange={(e) => setGenRoleId(e.target.value)}
                  style={ui.select}
                >
                  {db.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={ui.label}>Jornada Contratual Padrão</label>
                <select
                  value={genShiftId}
                  onChange={(e) => setGenShiftId(e.target.value)}
                  style={ui.select}
                >
                  {db.workShifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      [{sh.shiftPeriod}] {sh.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={ui.label}>Regra de Escala Padrão</label>
                <select
                  value={genRuleId}
                  onChange={(e) => setGenRuleId(e.target.value)}
                  style={ui.select}
                >
                  {db.scheduleRules.map((rl) => (
                    <option key={rl.id} value={rl.id}>
                      {rl.code} — {rl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={ui.label}>Qtd. de Postos a Gerar</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={genQuantity}
                  onChange={(e) => setGenQuantity(e.target.value)}
                  style={ui.input}
                />
              </div>

              <div>
                <label style={ui.label}>Situação Inicial da Vaga</label>
                <select
                  value={genStatus}
                  onChange={(e) => setGenStatus(e.target.value)}
                  style={ui.select}
                >
                  <option value="OPEN_AUTHORIZED">Autorizada p/ Contratação</option>
                  <option value="OPEN_UNPLANNED">Não Preenchida (Sem Autorização)</option>
                  <option value="FROZEN">Congelada</option>
                </select>
              </div>

              <div>
                <label style={ui.label}>Custo Estimado R$ (Opcional)</label>
                <input
                  type="number"
                  placeholder="Sem valor fictício"
                  value={genCost}
                  onChange={(e) => setGenCost(e.target.value)}
                  style={ui.input}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 6 }}>
                <input
                  type="checkbox"
                  id="chk_rateio"
                  checked={genIsRateio}
                  onChange={(e) => setGenIsRateio(e.target.checked)}
                />
                <label htmlFor="chk_rateio" style={{ fontSize: 12, color: "#334155" }}>
                  Posto RATEIO (Compartilhado)
                </label>
              </div>

              <button type="submit" style={ui.btnPrimary}>
                Gerar {genQuantity} Posto(s)
              </button>
            </form>
          </div>

          {/* Listagem e Edição Completa do Quadro de Postos (Seção 16) */}
          <div style={ui.card}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div style={ui.cardTitle}>
                Quadro Estrutural de Postos e Vagas — {selectedUnitId} ({filteredPositions.length} registros)
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  value={filterSectorId}
                  onChange={(e) => setFilterSectorId(e.target.value)}
                  style={{ ...ui.select, width: 190 }}
                >
                  <option value="">Todos os Setores</option>
                  {db.sectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ ...ui.select, width: 190 }}
                >
                  <option value="">Todas as Situações</option>
                  {Object.entries(STATUS_VAGA_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="🔍 Buscar posto, ocupante ou observação..."
                  value={searchPos}
                  onChange={(e) => setSearchPos(e.target.value)}
                  style={{ ...ui.input, width: 240 }}
                />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={ui.table}>
                <thead>
                  <tr style={{ background: "var(--uniao-table-header-bg, #2B5690)", color: "#fff" }}>
                    <th style={ui.th}>Cód.</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Posto / Vaga</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Setor / Função</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Jornada & Regra Padrão</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Ocupante Atual</th>
                    <th style={ui.th}>Situação da Vaga</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Observações</th>
                    <th style={ui.th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.map((pos) => {
                    const occupant = occupantByPositionId[pos.id];
                    const shift = shiftsById[pos.defaultShiftId];
                    const rule = rulesById[pos.defaultRuleId];
                    const effectiveStatus = occupant ? "FILLED" : pos.status;
                    const meta = STATUS_VAGA_META[effectiveStatus] || STATUS_VAGA_META.OPEN_UNPLANNED;

                    return (
                      <tr key={pos.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ ...ui.td, textAlign: "center", fontWeight: 700 }}>
                          {pos.isSharedRateio ? (
                            <span
                              style={{
                                background: "#f3e8ff",
                                color: "#6b21a8",
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 10,
                              }}
                            >
                              RATEIO
                            </span>
                          ) : (
                            pos.code
                          )}
                        </td>
                        <td style={{ ...ui.td, fontWeight: 700, color: "#0f172a" }}>{pos.title}</td>
                        <td style={{ ...ui.td, fontSize: 11, color: "#475569" }}>
                          <div style={{ fontWeight: 700 }}>{sectorsById[pos.sectorId]?.name}</div>
                          <div style={{ fontSize: 10 }}>{rolesById[pos.roleId]?.name}</div>
                        </td>
                        <td style={{ ...ui.td, fontSize: 11, color: "#334155" }}>
                          <div>
                            <strong>{shift?.shiftPeriod}</strong> · {shift?.entryTime} às{" "}
                            {shift?.effectiveExitTime}
                          </div>
                          <div style={{ color: "#1d4ed8", fontSize: 10, fontWeight: 700 }}>
                            {rule?.code}
                          </div>
                        </td>
                        <td style={ui.td}>
                          {occupant ? (
                            <div>
                              <div style={{ fontWeight: 700, color: "#166534" }}>
                                {occupant.fullName}
                              </div>
                              <div style={{ fontSize: 10, color: "#64748b" }}>
                                {occupant.registrationCode} · Adm:{" "}
                                {occupant.hireDate.split("-").reverse().join("/")}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 11 }}>
                              Vaga em aberto
                            </span>
                          )}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: meta.bg,
                              color: meta.cor,
                              display: "inline-block",
                            }}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ ...ui.td, fontSize: 11, color: "#475569", maxWidth: 220 }}>
                          {pos.notes || "—"}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap" }}>
                            <button
                              onClick={() => setEditingPos({ ...pos })}
                              style={ui.btnSmall}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => handleDeletePosition(pos)}
                              style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                            >
                              🗑️ Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL DE EDIÇÃO COMPLETA DE POSTO DE TRABALHO (Seção 16) */}
      {editingPos && (
        <div style={ui.modalBackdrop}>
          <div style={ui.modalCard}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
              ✏️ Editar Posto de Trabalho — [{editingPos.code}] {editingPos.title}
            </div>
            <form
              onSubmit={handleSaveEditedPosition}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
            >
              <div>
                <label style={ui.label}>Código do Posto</label>
                <input
                  value={editingPos.code}
                  onChange={(e) => setEditingPos({ ...editingPos, code: e.target.value })}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>Título / Identificação do Posto</label>
                <input
                  value={editingPos.title}
                  onChange={(e) => setEditingPos({ ...editingPos, title: e.target.value })}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>Setor</label>
                <select
                  value={editingPos.sectorId}
                  onChange={(e) => setEditingPos({ ...editingPos, sectorId: e.target.value })}
                  style={ui.select}
                >
                  {db.sectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ui.label}>Função Associada</label>
                <select
                  value={editingPos.roleId}
                  onChange={(e) => setEditingPos({ ...editingPos, roleId: e.target.value })}
                  style={ui.select}
                >
                  {db.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ui.label}>Jornada Contratual Padrão</label>
                <select
                  value={editingPos.defaultShiftId || ""}
                  onChange={(e) => setEditingPos({ ...editingPos, defaultShiftId: e.target.value })}
                  style={ui.select}
                >
                  {db.workShifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      [{sh.shiftPeriod}] {sh.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ui.label}>Regra de Escala Padrão</label>
                <select
                  value={editingPos.defaultRuleId || ""}
                  onChange={(e) => setEditingPos({ ...editingPos, defaultRuleId: e.target.value })}
                  style={ui.select}
                >
                  {db.scheduleRules.map((rl) => (
                    <option key={rl.id} value={rl.id}>
                      {rl.code} — {rl.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ui.label}>Situação da Vaga</label>
                <select
                  value={editingPos.status}
                  onChange={(e) => setEditingPos({ ...editingPos, status: e.target.value })}
                  style={ui.select}
                >
                  <option value="FILLED">Preenchida</option>
                  <option value="OPEN_AUTHORIZED">Vaga Aberta (Autorizada)</option>
                  <option value="OPEN_UNPLANNED">Vaga Não Preenchida</option>
                  <option value="FROZEN">Vaga Congelada</option>
                  <option value="DEACTIVATED">Desativada (Preserva Histórico)</option>
                </select>
              </div>
              <div>
                <label style={ui.label}>Custo Estimado Mensal R$</label>
                <input
                  type="number"
                  value={editingPos.estimatedMonthlyCost ?? ""}
                  onChange={(e) =>
                    setEditingPos({ ...editingPos, estimatedMonthlyCost: e.target.value })
                  }
                  placeholder="Opcional"
                  style={ui.input}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(editingPos.isSharedRateio)}
                    onChange={(e) =>
                      setEditingPos({ ...editingPos, isSharedRateio: e.target.checked })
                    }
                  />
                  Posto de RATEIO (Compartilhado entre múltiplas unidades)
                </label>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={ui.label}>Observações do Posto / Vaga</label>
                <textarea
                  rows={2}
                  value={editingPos.notes || ""}
                  onChange={(e) => setEditingPos({ ...editingPos, notes: e.target.value })}
                  style={ui.input}
                />
              </div>
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleDeletePosition(editingPos)}
                  style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                >
                  🗑️ Excluir Este Posto
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditingPos(null)}
                    style={ui.btnSmall}
                  >
                    Cancelar
                  </button>
                  <button type="submit" style={ui.btnPrimary}>
                    Salvar Alterações do Posto
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const ui = createUniaoModuleUi({
  select: {
    width: "100%",
  },
  input: {
    width: "100%",
  },
});
