// =============================================================================
// ESTRUTURA ORGANIZACIONAL (EMPRESA, UNIDADES, SETORES, CATEGORIAS, FUNÇÕES) E
// GESTÃO COMPLETA DO QUADRO DE POSTOS E VAGAS (v8.0 — Seções 6, 16 e 19)
// =============================================================================

import { useState, useMemo, useEffect } from "react";
import {
  createSequentialPositions,
  STATUS_VAGA_META,
} from "../domain/scheduleEngine.js";
import { createUniaoModuleUi } from "../theme/uniaoTheme.js";
import { Tabs, PageHeader, Alert } from "../ui/index.jsx";

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

  const units = db.units || [];
  const sectors = db.sectors || [];
  const unitSectors = db.unitSectors || [];
  const functionalCategories = db.functionalCategories || [];
  const roles = db.roles || [];
  const workShifts = db.workShifts || [];
  const scheduleRules = db.scheduleRules || [];
  const workPositions = db.workPositions || [];
  const allocations = db.allocations || [];
  const employees = db.employees || [];

  // Cadastro / Edição de Unidades (Lojas)
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitLegalName, setUnitLegalName] = useState("");
  const [unitCnpj, setUnitCnpj] = useState("");
  const [unitEstablishmentType, setUnitEstablishmentType] = useState("FILIAL");
  const [unitZipCode, setUnitZipCode] = useState("");
  const [unitStreet, setUnitStreet] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [unitComplement, setUnitComplement] = useState("");
  const [unitNeighborhood, setUnitNeighborhood] = useState("");
  const [unitCity, setUnitCity] = useState("");
  const [unitState, setUnitState] = useState("");

  // Cadastro / Edição de Setores
  const [editingSectorId, setEditingSectorId] = useState(null);
  const [newSectorName, setNewSectorName] = useState("");
  const [newSectorCode, setNewSectorCode] = useState("");
  const [newSectorMinCov, setNewSectorMinCov] = useState(2);
  const [newSectorSunCov, setNewSectorSunCov] = useState(1);

  // Cadastro / Edição de Categorias Funcionais
  const [editingCatId, setEditingCatId] = useState(null);
  const [newCatCode, setNewCatCode] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [catFeedback, setCatFeedback] = useState(null);

  // Cadastro / Edição de Funções
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleCatId, setNewRoleCatId] = useState(() => functionalCategories[0]?.id || "");
  const [newRoleSecId, setNewRoleSecId] = useState(() => sectors[0]?.id || "");
  const [newRoleCost, setNewRoleCost] = useState("");
  const [roleFeedback, setRoleFeedback] = useState(null);

  // Gerador Automático de Postos por Quantidade
  const [genSectorId, setGenSectorId] = useState(() => sectors[0]?.id || "");
  const [genRoleId, setGenRoleId] = useState(() => roles[0]?.id || "");
  const [genShiftId, setGenShiftId] = useState(
    () => workShifts.find((s) => s.active !== false)?.id || workShifts[0]?.id || ""
  );
  const [genRuleId, setGenRuleId] = useState(
    () => scheduleRules.find((r) => r.active !== false)?.id || scheduleRules[0]?.id || ""
  );
  const [genQuantity, setGenQuantity] = useState(3);
  const [genIsRateio, setGenIsRateio] = useState(false);
  const [genStatus, setGenStatus] = useState("OPEN_AUTHORIZED");
  const [genCost, setGenCost] = useState("");
  const [batchFeedback, setBatchFeedback] = useState(null);

  const unitsById = useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u])),
    [units]
  );
  const selectedUnit = unitsById[selectedUnitId] || null;
  const selectedUnitLabel = selectedUnit?.name || selectedUnit?.code || selectedUnitId || "—";

  const categoriesById = useMemo(
    () => Object.fromEntries(functionalCategories.map((c) => [c.id, c])),
    [functionalCategories]
  );
  const sectorsById = useMemo(
    () => Object.fromEntries(sectors.map((s) => [s.id, s])),
    [sectors]
  );
  const rolesById = useMemo(
    () => Object.fromEntries(roles.map((r) => [r.id, r])),
    [roles]
  );
  const shiftsById = useMemo(
    () => Object.fromEntries(workShifts.map((s) => [s.id, s])),
    [workShifts]
  );
  const rulesById = useMemo(
    () => Object.fromEntries(scheduleRules.map((r) => [r.id, r])),
    [scheduleRules]
  );

  // Sincronização dinâmica dos seletores quando os registros do banco forem carregados ou alterados
  useEffect(() => {
    if (!editingRoleId) {
      if (!categoriesById[newRoleCatId]) {
        setNewRoleCatId(functionalCategories[0]?.id || "");
      }
      if (!sectorsById[newRoleSecId]) {
        setNewRoleSecId(sectors[0]?.id || "");
      }
    }
  }, [
    editingRoleId,
    categoriesById,
    sectorsById,
    newRoleCatId,
    newRoleSecId,
    functionalCategories,
    sectors,
  ]);

  useEffect(() => {
    if (!sectorsById[genSectorId]) {
      setGenSectorId(sectors[0]?.id || "");
    }
  }, [sectorsById, genSectorId, sectors]);

  const filteredGenRoles = useMemo(
    () => (genSectorId ? roles.filter((r) => r.defaultSectorId === genSectorId) : []),
    [roles, genSectorId]
  );

  useEffect(() => {
    if (!filteredGenRoles.some((r) => r.id === genRoleId)) {
      setGenRoleId(filteredGenRoles[0]?.id || "");
    }
  }, [filteredGenRoles, genRoleId]);

  useEffect(() => {
    if (!shiftsById[genShiftId]) {
      setGenShiftId(
        workShifts.find((s) => s.active !== false)?.id || workShifts[0]?.id || ""
      );
    }
  }, [shiftsById, genShiftId, workShifts]);

  useEffect(() => {
    if (!rulesById[genRuleId]) {
      setGenRuleId(
        scheduleRules.find((r) => r.active !== false)?.id || scheduleRules[0]?.id || ""
      );
    }
  }, [rulesById, genRuleId, scheduleRules]);

  const rolesWithInvalidRefs = useMemo(
    () =>
      roles.filter(
        (r) =>
          !r.categoryId ||
          !categoriesById[r.categoryId] ||
          !r.defaultSectorId ||
          !sectorsById[r.defaultSectorId]
      ),
    [roles, categoriesById, sectorsById]
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

  const isPositionVisibleInUnit = (pos, targetUnitId) => {
    if (!targetUnitId) return true;
    if (pos.unitId === targetUnitId) return true;
    if (!pos.isSharedRateio) return false;
    if (Array.isArray(pos.authorizedUnitIds) && pos.authorizedUnitIds.length > 0) {
      return pos.authorizedUnitIds.includes(targetUnitId);
    }
    return true;
  };

  const filteredPositions = useMemo(() => {
    return db.workPositions
      .filter((p) => isPositionVisibleInUnit(p, selectedUnitId))
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
              legalName: unitLegalName.trim(),
              cnpj: unitCnpj.trim(),
              establishmentType: unitEstablishmentType || "FILIAL",
              zipCode: unitZipCode.trim(),
              street: unitStreet.trim(),
              number: unitNumber.trim(),
              complement: unitComplement.trim(),
              neighborhood: unitNeighborhood.trim(),
              city: unitCity.trim(),
              state: unitState.trim().toUpperCase(),
            };
          }
        } else {
          draft.units.push({
            id: createdUnitId,
            companyId: draft.companies[0]?.id || "comp_default",
            code: cleanCode,
            name: cleanName,
            legalName: unitLegalName.trim(),
            cnpj: unitCnpj.trim(),
            establishmentType: unitEstablishmentType || "FILIAL",
            zipCode: unitZipCode.trim(),
            street: unitStreet.trim(),
            number: unitNumber.trim(),
            complement: unitComplement.trim(),
            neighborhood: unitNeighborhood.trim(),
            city: unitCity.trim(),
            state: unitState.trim().toUpperCase(),
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
    setUnitLegalName("");
    setUnitCnpj("");
    setUnitEstablishmentType("FILIAL");
    setUnitZipCode("");
    setUnitStreet("");
    setUnitNumber("");
    setUnitComplement("");
    setUnitNeighborhood("");
    setUnitCity("");
    setUnitState("");
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

  // Criar ou Editar Categoria Funcional
  const handleSaveCategory = (e) => {
    e.preventDefault();
    const cleanCode = newCatCode.trim().toUpperCase();
    const cleanName = newCatName.trim();
    if (!cleanCode || !cleanName) {
      setCatFeedback({
        tone: "danger",
        text: "Informe o código e o nome da categoria funcional.",
      });
      return;
    }

    const duplicateCode = functionalCategories.some(
      (c) => c.id !== editingCatId && String(c.code || "").toUpperCase() === cleanCode
    );
    if (duplicateCode) {
      setCatFeedback({
        tone: "danger",
        text: `Já existe uma categoria funcional com o código "${cleanCode}".`,
      });
      return;
    }

    const createdCatId = editingCatId ? null : `CAT_${cleanCode}_${Date.now()}`;

    onMutateDb({
      permission: "MANAGE_STRUCTURE",
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: editingCatId ? "EDITAR_CATEGORIA_FUNCIONAL" : "CRIAR_CATEGORIA_FUNCIONAL",
      entityType: "FUNCTIONAL_CATEGORY",
      entityId: editingCatId || createdCatId,
      summary: `${editingCatId ? "Atualizada" : "Cadastrada"} categoria funcional "${cleanName}" (${cleanCode}).`,
      updater: (draft) => {
        if (!Array.isArray(draft.functionalCategories)) draft.functionalCategories = [];
        if (editingCatId) {
          const cat = draft.functionalCategories.find((c) => c.id === editingCatId);
          if (cat) {
            cat.code = cleanCode;
            cat.name = cleanName;
          }
        } else {
          draft.functionalCategories.push({
            id: createdCatId,
            code: cleanCode,
            name: cleanName,
            hierarchyLevel: draft.functionalCategories.length + 1,
            active: true,
          });
        }
      },
    });

    setCatFeedback({
      tone: "success",
      text: `Categoria "${cleanName}" (${cleanCode}) ${editingCatId ? "atualizada" : "cadastrada"} com sucesso.`,
    });
    setEditingCatId(null);
    setNewCatCode("");
    setNewCatName("");
  };

  // Excluir Categoria Funcional (bloqueada quando houver funções vinculadas)
  const handleDeleteCategory = (cat) => {
    if (!cat) return;
    const linkedRoles = roles.filter((r) => r.categoryId === cat.id);
    if (linkedRoles.length > 0) {
      setCatFeedback({
        tone: "danger",
        text: `Não é possível excluir a categoria "${cat.name}" porque existem ${linkedRoles.length} função(ões) vinculada(s). Regularize ou desvincule essas funções antes de excluir.`,
      });
      return;
    }

    onMutateDb({
      permission: "MANAGE_STRUCTURE",
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: "EXCLUIR_CATEGORIA_FUNCIONAL",
      entityType: "FUNCTIONAL_CATEGORY",
      entityId: cat.id,
      summary: `Excluída categoria funcional "${cat.name}" (${cat.code}).`,
      updater: (draft) => {
        draft.functionalCategories = (draft.functionalCategories || []).filter(
          (c) => c.id !== cat.id
        );
      },
    });

    setCatFeedback({
      tone: "success",
      text: `Categoria "${cat.name}" excluída.`,
    });
    if (editingCatId === cat.id) {
      setEditingCatId(null);
      setNewCatCode("");
      setNewCatName("");
    }
  };

  // Criar ou Editar Função (Role)
  const handleSaveRole = (e) => {
    e.preventDefault();
    const cleanCode = newRoleCode.trim().toUpperCase();
    const cleanName = newRoleName.trim().toUpperCase();
    if (!cleanName || !cleanCode) {
      setRoleFeedback({
        tone: "danger",
        text: "Informe o código e o nome da função.",
      });
      return;
    }
    if (!newRoleCatId || !categoriesById[newRoleCatId]) {
      setRoleFeedback({
        tone: "danger",
        text: "Selecione uma categoria funcional válida cadastrada no banco antes de salvar a função.",
      });
      return;
    }
    if (!newRoleSecId || !sectorsById[newRoleSecId]) {
      setRoleFeedback({
        tone: "danger",
        text: "Selecione um setor padrão válido cadastrado no banco antes de salvar a função.",
      });
      return;
    }

    const costVal = newRoleCost ? Number(newRoleCost) : null;
    const createdRoleId = editingRoleId ? null : `R_${cleanCode}_${Date.now()}`;

    onMutateDb({
      permission: "MANAGE_STRUCTURE",
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: editingRoleId ? "EDITAR_FUNCAO" : "CRIAR_FUNCAO",
      entityType: "ROLE",
      entityId: editingRoleId || createdRoleId,
      summary: `${editingRoleId ? "Atualizada" : "Cadastrada"} função "${cleanName}" (${cleanCode}).`,
      updater: (draft) => {
        if (!Array.isArray(draft.roles)) draft.roles = [];
        if (editingRoleId) {
          const r = draft.roles.find((x) => x.id === editingRoleId);
          if (r) {
            r.name = cleanName;
            r.code = cleanCode;
            r.categoryId = newRoleCatId;
            r.defaultSectorId = newRoleSecId;
            r.projectedMonthlyCost = costVal;
          }
        } else {
          draft.roles.push({
            id: createdRoleId,
            categoryId: newRoleCatId,
            defaultSectorId: newRoleSecId,
            code: cleanCode,
            name: cleanName,
            hierarchyRank: 20,
            projectedMonthlyCost: costVal,
            active: true,
          });
        }
      },
    });
    setRoleFeedback({
      tone: "success",
      text: `Função "${cleanName}" (${cleanCode}) ${editingRoleId ? "atualizada" : "cadastrada"} com sucesso.`,
    });
    setEditingRoleId(null);
    setNewRoleName("");
    setNewRoleCode("");
    setNewRoleCost("");
  };

  // Geração automática de N postos numerados
  const handleCreateBatchPositions = (e) => {
    e.preventDefault();
    if (!selectedUnitId || !unitsById[selectedUnitId]) {
      setBatchFeedback({
        tone: "danger",
        text: "Selecione uma unidade operacional válida antes de gerar postos.",
      });
      return;
    }
    const sector = sectorsById[genSectorId];
    if (!sector) {
      setBatchFeedback({
        tone: "danger",
        text: "Selecione um setor operacional válido antes de gerar postos.",
      });
      return;
    }
    const role = rolesById[genRoleId];
    if (!role) {
      setBatchFeedback({
        tone: "danger",
        text: "Selecione uma função válida antes de gerar postos.",
      });
      return;
    }
    if (role.defaultSectorId !== sector.id) {
      setBatchFeedback({
        tone: "danger",
        text: `A função "${role.name}" não pertence ao setor "${sector.name}". Selecione uma função vinculada ao setor.`,
      });
      return;
    }
    const shift = shiftsById[genShiftId];
    if (!shift) {
      setBatchFeedback({
        tone: "danger",
        text: "Selecione uma jornada contratual válida antes de gerar postos.",
      });
      return;
    }
    const rule = rulesById[genRuleId];
    if (!rule) {
      setBatchFeedback({
        tone: "danger",
        text: "Selecione uma regra de escala válida antes de gerar postos.",
      });
      return;
    }
    const qty = Number(genQuantity);
    if (!Number.isFinite(qty) || qty < 1 || qty > 50) {
      setBatchFeedback({
        tone: "danger",
        text: "Informe uma quantidade válida entre 1 e 50 postos.",
      });
      return;
    }

    const existingForRole = workPositions.filter(
      (p) => p.unitId === selectedUnitId && p.roleId === genRoleId && !p.isSharedRateio
    );
    const startNum = existingForRole.length + 1;
    const costVal = genCost ? Number(genCost) : null;

    const newPositions = createSequentialPositions({
      unitId: selectedUnitId,
      sectorId: sector.id,
      role,
      quantity: Math.floor(qty),
      startNumber: startNum,
      defaultShiftId: shift.id,
      defaultRuleId: rule.id,
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
      unitId: selectedUnitId,
      summary: `Criados automaticamente ${newPositions.length} posto(s) para a função ${role.name} (${newPositions[0].title} até ${newPositions[newPositions.length - 1].title}) na unidade ${selectedUnitLabel}.`,
      updater: (draft) => {
        if (!Array.isArray(draft.workPositions)) draft.workPositions = [];
        draft.workPositions.push(...newPositions);
      },
    });
    setBatchFeedback({
      tone: "success",
      text: `${newPositions.length} posto(s) de "${role.name}" gerado(s) com sucesso em ${selectedUnitLabel}.`,
    });
  };

  // Salvar Edição Completa de um Posto de Trabalho (Seção 16)
  const handleSaveEditedPosition = (e) => {
    e.preventDefault();
    if (!editingPos) return;
    const editedRole = rolesById[editingPos.roleId];
    if (!editedRole || editedRole.defaultSectorId !== editingPos.sectorId) {
      setBatchFeedback({
        tone: "danger",
        text: "Selecione uma função compatível com o setor do posto antes de salvar.",
      });
      return;
    }

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
    { id: "units", label: "Unidades", icon: "store", badge: units.length },
    { id: "sectors", label: "Setores", icon: "layers", badge: sectors.length },
    {
      id: "categories",
      label: "Categorias funcionais",
      icon: "sliders",
      badge: functionalCategories.length,
    },
    { id: "roles", label: "Funções e cargos", icon: "briefcase", badge: roles.length },
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
          <div style={ui.cardTitle}>Unidades operacionais (Matriz e Filiais)</div>
          <form
            onSubmit={handleSaveUnit}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 8,
              alignItems: "end",
              marginBottom: 14,
            }}
          >
            <div>
              <label style={ui.label}>Código *</label>
              <input
                placeholder="Ex: LJ04"
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                style={ui.input}
                required
              />
            </div>
            <div>
              <label style={ui.label}>Nome da Unidade *</label>
              <input
                placeholder="Ex: LOJA 04"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                style={ui.input}
                required
              />
            </div>
            <div>
              <label style={ui.label}>Tipo de Estabelecimento</label>
              <select
                value={unitEstablishmentType}
                onChange={(e) => setUnitEstablishmentType(e.target.value)}
                style={ui.select}
              >
                <option value="FILIAL">Filial</option>
                <option value="MATRIZ">Matriz</option>
              </select>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={ui.label}>Razão Social</label>
              <input
                placeholder="Razão social do estabelecimento"
                value={unitLegalName}
                onChange={(e) => setUnitLegalName(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>CNPJ</label>
              <input
                placeholder="00.000.000/0000-00"
                value={unitCnpj}
                onChange={(e) => setUnitCnpj(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>CEP</label>
              <input
                placeholder="00000-000"
                value={unitZipCode}
                onChange={(e) => setUnitZipCode(e.target.value)}
                style={ui.input}
              />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={ui.label}>Logradouro</label>
              <input
                placeholder="Rua, Avenida, Praça..."
                value={unitStreet}
                onChange={(e) => setUnitStreet(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Número</label>
              <input
                placeholder="Ex: 120"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Complemento</label>
              <input
                placeholder="Sala, Bloco..."
                value={unitComplement}
                onChange={(e) => setUnitComplement(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Bairro</label>
              <input
                placeholder="Bairro"
                value={unitNeighborhood}
                onChange={(e) => setUnitNeighborhood(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Cidade</label>
              <input
                placeholder="Ex: Belo Horizonte"
                value={unitCity}
                onChange={(e) => setUnitCity(e.target.value)}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>UF</label>
              <input
                placeholder="MG"
                maxLength={2}
                value={unitState}
                onChange={(e) => setUnitState(e.target.value.toUpperCase())}
                style={ui.input}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="submit" style={ui.btnPrimary}>
                {editingUnitId ? "Salvar unidade" : "Adicionar unidade"}
              </button>
              {editingUnitId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingUnitId(null);
                    setUnitCode("");
                    setUnitName("");
                    setUnitLegalName("");
                    setUnitCnpj("");
                    setUnitEstablishmentType("FILIAL");
                    setUnitZipCode("");
                    setUnitStreet("");
                    setUnitNumber("");
                    setUnitComplement("");
                    setUnitNeighborhood("");
                    setUnitCity("");
                    setUnitState("");
                  }}
                  style={ui.btnSmall}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Código</th>
                <th style={ui.th}>Unidade</th>
                <th style={ui.th}>Dados Fiscais (Razão Social / CNPJ)</th>
                <th style={ui.th}>Endereço / Cidade · UF</th>
                <th style={{ ...ui.th, textAlign: "center" }}>Postos</th>
                <th style={{ ...ui.th, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {db.units.map((u) => {
                const posCount = db.workPositions.filter((p) => p.unitId === u.id).length;
                const fiscalPending = !String(u.cnpj || "").trim() || !String(u.legalName || "").trim();
                const addrStreet = [u.street, u.number, u.complement].filter(Boolean).join(", ");
                const addrDistrict = [u.neighborhood, u.zipCode ? `CEP ${u.zipCode}` : ""].filter(Boolean).join(" · ");
                return (
                  <tr key={u.id}>
                    <td style={{ ...ui.td, fontWeight: 700 }}>
                      <div>{u.code}</div>
                      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                        {u.establishmentType === "MATRIZ" ? "MATRIZ" : "FILIAL"}
                      </div>
                    </td>
                    <td style={{ ...ui.td, fontWeight: 600 }}>
                      {u.name}{" "}
                      {u.id === selectedUnitId && (
                        <span style={{ fontSize: 12, color: "var(--erp-brand-blue)" }}>
                          (Ativa)
                        </span>
                      )}
                    </td>
                    <td style={ui.td}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {u.legalName || <span style={{ color: "#b45309" }}>Razão social pendente</span>}
                      </div>
                      <div style={{ fontSize: 11, color: u.cnpj ? "#475569" : "#b45309" }}>
                        {u.cnpj ? `CNPJ ${u.cnpj}` : "CNPJ pendente"}
                      </div>
                      {fiscalPending && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 2,
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#b45309",
                            background: "#fef3c7",
                            padding: "1px 6px",
                            borderRadius: 4,
                          }}
                        >
                          Completar cadastro fiscal
                        </span>
                      )}
                    </td>
                    <td style={ui.td}>
                      {addrStreet && <div style={{ fontSize: 11.5 }}>{addrStreet}</div>}
                      {addrDistrict && <div style={{ fontSize: 11, color: "#64748b" }}>{addrDistrict}</div>}
                      <div>
                        {u.city || "—"} {u.state ? `· ${u.state}` : ""}
                      </div>
                    </td>
                    <td style={{ ...ui.td, textAlign: "center" }}>{posCount}</td>
                    <td style={{ ...ui.td, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUnitId(u.id);
                            setUnitCode(u.code || "");
                            setUnitName(u.name || "");
                            setUnitLegalName(u.legalName || "");
                            setUnitCnpj(u.cnpj || "");
                            setUnitEstablishmentType(u.establishmentType || "FILIAL");
                            setUnitZipCode(u.zipCode || "");
                            setUnitStreet(u.street || "");
                            setUnitNumber(u.number || "");
                            setUnitComplement(u.complement || "");
                            setUnitNeighborhood(u.neighborhood || "");
                            setUnitCity(u.city || "");
                            setUnitState(u.state || "");
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
            Setores operacionais e cobertura mínima — {selectedUnitLabel}
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
                <th style={{ ...ui.th, textAlign: "center" }}>Postos — {selectedUnitLabel}</th>
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

      {activeSection === "categories" && (
        <div style={ui.card}>
          <div style={ui.cardTitle}>Categorias funcionais</div>
          <div style={{ fontSize: 12, color: "var(--erp-ink-secondary)", marginBottom: 12 }}>
            Cadastre manualmente as categorias funcionais utilizadas para classificar funções e cargos.
          </div>

          {catFeedback && (
            <div style={{ marginBottom: 12 }}>
              <Alert tone={catFeedback.tone}>{catFeedback.text}</Alert>
            </div>
          )}

          <form
            onSubmit={handleSaveCategory}
            style={{
              display: "grid",
              gridTemplateColumns: "0.9fr 1.6fr auto auto",
              gap: 8,
              alignItems: "end",
              marginBottom: 14,
            }}
          >
            <div>
              <label style={ui.label}>Código</label>
              <input
                type="text"
                placeholder="Ex: PERECIVEIS"
                value={newCatCode}
                onChange={(e) => {
                  setNewCatCode(e.target.value);
                  if (catFeedback) setCatFeedback(null);
                }}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Nome da Categoria</label>
              <input
                type="text"
                placeholder="Ex: Operação de Perecíveis"
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value);
                  if (catFeedback) setCatFeedback(null);
                }}
                style={ui.input}
              />
            </div>
            <button type="submit" style={ui.btnPrimary}>
              {editingCatId ? "Salvar categoria" : "Adicionar categoria"}
            </button>
            {editingCatId && (
              <button
                type="button"
                onClick={() => {
                  setEditingCatId(null);
                  setNewCatCode("");
                  setNewCatName("");
                  setCatFeedback(null);
                }}
                style={ui.btnSmall}
              >
                Cancelar
              </button>
            )}
          </form>

          {functionalCategories.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--erp-ink-muted)", padding: "8px 0" }}>
              Nenhuma categoria funcional cadastrada ainda. Utilize o formulário acima para cadastrar.
            </div>
          ) : (
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Código</th>
                  <th style={ui.th}>Categoria</th>
                  <th style={{ ...ui.th, textAlign: "center" }}>Funções vinculadas</th>
                  <th style={{ ...ui.th, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {functionalCategories.map((c) => {
                  const linkedCount = roles.filter((r) => r.categoryId === c.id).length;
                  return (
                    <tr key={c.id}>
                      <td style={{ ...ui.td, fontWeight: 700 }}>{c.code}</td>
                      <td style={{ ...ui.td, fontWeight: 600 }}>{c.name}</td>
                      <td style={{ ...ui.td, textAlign: "center" }}>{linkedCount}</td>
                      <td style={{ ...ui.td, textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(c.id);
                              setNewCatCode(c.code || "");
                              setNewCatName(c.name || "");
                              setCatFeedback(null);
                            }}
                            style={ui.btnSmall}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c)}
                            title={
                              linkedCount > 0
                                ? `Possui ${linkedCount} função(ões) vinculada(s)`
                                : "Excluir categoria"
                            }
                            style={{
                              ...ui.btnSmall,
                              color: linkedCount > 0 ? "var(--erp-ink-muted)" : "var(--erp-danger)",
                              opacity: linkedCount > 0 ? 0.65 : 1,
                            }}
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
          )}
        </div>
      )}

      {activeSection === "roles" && (
        <div style={ui.card}>
          <div style={ui.cardTitle}>Catálogo de funções e cargos</div>

          {rolesWithInvalidRefs.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Alert tone="warning" title="Funções com categoria ou setor pendente de regularização">
                Existem {rolesWithInvalidRefs.length} função(ões) com referência de categoria ou setor
                padrão inválida/ausente. Clique em <strong>Editar</strong> na função correspondente para
                vincular registros válidos.
              </Alert>
            </div>
          )}

          {roleFeedback && (
            <div style={{ marginBottom: 12 }}>
              <Alert tone={roleFeedback.tone}>{roleFeedback.text}</Alert>
            </div>
          )}

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
                onChange={(e) => {
                  setNewRoleCode(e.target.value);
                  if (roleFeedback) setRoleFeedback(null);
                }}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Nome da Função</label>
              <input
                type="text"
                placeholder="Nome da Função"
                value={newRoleName}
                onChange={(e) => {
                  setNewRoleName(e.target.value);
                  if (roleFeedback) setRoleFeedback(null);
                }}
                style={ui.input}
              />
            </div>
            <div>
              <label style={ui.label}>Categoria</label>
              <select
                value={categoriesById[newRoleCatId] ? newRoleCatId : ""}
                onChange={(e) => {
                  setNewRoleCatId(e.target.value);
                  if (roleFeedback) setRoleFeedback(null);
                }}
                style={ui.select}
              >
                {(functionalCategories.length === 0 || !categoriesById[newRoleCatId]) && (
                  <option value="">
                    {functionalCategories.length === 0
                      ? "Nenhuma categoria cadastrada"
                      : "Selecione uma categoria válida..."}
                  </option>
                )}
                {functionalCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={ui.label}>Setor Padrão</label>
              <select
                value={sectorsById[newRoleSecId] ? newRoleSecId : ""}
                onChange={(e) => {
                  setNewRoleSecId(e.target.value);
                  if (roleFeedback) setRoleFeedback(null);
                }}
                style={ui.select}
              >
                {(sectors.length === 0 || !sectorsById[newRoleSecId]) && (
                  <option value="">
                    {sectors.length === 0
                      ? "Nenhum setor cadastrado"
                      : "Selecione um setor válido..."}
                  </option>
                )}
                {sectors.map((s) => (
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
            <div style={{ display: "flex", gap: 6 }}>
              <button type="submit" style={ui.btnPrimary}>
                {editingRoleId ? "Salvar função" : "Adicionar função"}
              </button>
              {editingRoleId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoleId(null);
                    setNewRoleCode("");
                    setNewRoleName("");
                    setNewRoleCatId(functionalCategories[0]?.id || "");
                    setNewRoleSecId(sectors[0]?.id || "");
                    setNewRoleCost("");
                    setRoleFeedback(null);
                  }}
                  style={ui.btnSmall}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Função / Cargo</th>
                <th style={ui.th}>Categoria</th>
                <th style={ui.th}>Setor Padrão</th>
                <th style={{ ...ui.th, textAlign: "center" }}>Postos — {selectedUnitLabel}</th>
                <th style={{ ...ui.th, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const count = workPositions.filter(
                  (p) => p.unitId === selectedUnitId && p.roleId === r.id
                ).length;
                const cat = categoriesById[r.categoryId];
                const sec = sectorsById[r.defaultSectorId];
                return (
                  <tr key={r.id}>
                    <td style={{ ...ui.td, fontWeight: 600 }}>{r.name}</td>
                    <td style={ui.td}>
                      {cat ? (
                        <span style={{ color: "var(--erp-ink-secondary)" }}>{cat.name}</span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--erp-danger)",
                            background: "#fef2f2",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          Pendente / inválida
                        </span>
                      )}
                    </td>
                    <td style={ui.td}>
                      {sec ? (
                        <span style={{ color: "var(--erp-ink-secondary)" }}>{sec.name}</span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--erp-danger)",
                            background: "#fef2f2",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          Pendente / inválido
                        </span>
                      )}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center" }}>{count}</td>
                    <td style={{ ...ui.td, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRoleId(r.id);
                            setNewRoleCode(r.code || "");
                            setNewRoleName(r.name || "");
                            setNewRoleCatId(categoriesById[r.categoryId] ? r.categoryId : "");
                            setNewRoleSecId(sectorsById[r.defaultSectorId] ? r.defaultSectorId : "");
                            setNewRoleCost(r.projectedMonthlyCost ?? "");
                            setRoleFeedback(null);
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
              Criação de postos de trabalho em lote ({selectedUnitLabel})
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Ao informar a Função e a Quantidade (ex.: <code>Açougueiro</code> · <code>3</code>), o
              sistema gera postos individuais com numeração sequencial automática na unidade ativa (
              <strong>{selectedUnitLabel}</strong>).
            </div>

            {(sectors.length === 0 ||
              roles.length === 0 ||
              workShifts.length === 0 ||
              scheduleRules.length === 0) && (
              <div style={{ marginBottom: 12 }}>
                <Alert tone="warning" title="Requisitos pendentes para geração de postos">
                  Para gerar postos em lote, é necessário possuir ao menos um setor, uma função, uma
                  jornada contratual e uma regra de escala cadastrados.
                </Alert>
              </div>
            )}

            {batchFeedback && (
              <div style={{ marginBottom: 12 }}>
                <Alert tone={batchFeedback.tone}>{batchFeedback.text}</Alert>
              </div>
            )}

            {genSectorId && filteredGenRoles.length === 0 && (
              <div style={{ marginBottom: 12 }}>
                <Alert tone="warning" title="Sem funções disponíveis para este setor">
                  Nenhuma função está vinculada ao setor{" "}
                  <strong>{sectorsById[genSectorId]?.name || ""}</strong>. Cadastre ou vincule uma
                  função a este setor antes de criar postos de trabalho.
                </Alert>
              </div>
            )}

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
                  value={sectorsById[genSectorId] ? genSectorId : ""}
                  onChange={(e) => {
                    const nextSecId = e.target.value;
                    setGenSectorId(nextSecId);
                    const nextRoles = roles.filter((r) => r.defaultSectorId === nextSecId);
                    if (!nextRoles.some((r) => r.id === genRoleId)) {
                      setGenRoleId(nextRoles[0]?.id || "");
                    }
                    if (batchFeedback) setBatchFeedback(null);
                  }}
                  style={ui.select}
                >
                  {sectors.length === 0 && <option value="">Nenhum setor cadastrado</option>}
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={ui.label}>Função</label>
                <select
                  value={filteredGenRoles.some((r) => r.id === genRoleId) ? genRoleId : ""}
                  onChange={(e) => {
                    setGenRoleId(e.target.value);
                    if (batchFeedback) setBatchFeedback(null);
                  }}
                  disabled={filteredGenRoles.length === 0}
                  style={ui.select}
                >
                  {filteredGenRoles.length === 0 && (
                    <option value="">
                      {genSectorId
                        ? "Nenhuma função vinculada a este setor"
                        : "Nenhuma função cadastrada"}
                    </option>
                  )}
                  {filteredGenRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={ui.label}>Jornada Contratual Padrão</label>
                <select
                  value={shiftsById[genShiftId] ? genShiftId : ""}
                  onChange={(e) => {
                    setGenShiftId(e.target.value);
                    if (batchFeedback) setBatchFeedback(null);
                  }}
                  style={ui.select}
                >
                  {workShifts.length === 0 && <option value="">Nenhuma jornada cadastrada</option>}
                  {workShifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      [{sh.shiftPeriod}] {sh.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={ui.label}>Regra de Escala Padrão</label>
                <select
                  value={rulesById[genRuleId] ? genRuleId : ""}
                  onChange={(e) => {
                    setGenRuleId(e.target.value);
                    if (batchFeedback) setBatchFeedback(null);
                  }}
                  style={ui.select}
                >
                  {scheduleRules.length === 0 && <option value="">Nenhuma regra cadastrada</option>}
                  {scheduleRules.map((rl) => (
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

              <button
                type="submit"
                disabled={filteredGenRoles.length === 0 || !genRoleId}
                style={{
                  ...ui.btnPrimary,
                  opacity: filteredGenRoles.length === 0 || !genRoleId ? 0.55 : 1,
                }}
              >
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
                Quadro Estrutural de Postos e Vagas — {selectedUnitLabel} ({filteredPositions.length} registros)
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
                  onChange={(e) => {
                    const nextSecId = e.target.value;
                    const sectorRoles = db.roles.filter((r) => r.defaultSectorId === nextSecId);
                    const keepRole = sectorRoles.some((r) => r.id === editingPos.roleId);
                    setEditingPos({
                      ...editingPos,
                      sectorId: nextSecId,
                      roleId: keepRole ? editingPos.roleId : sectorRoles[0]?.id || "",
                    });
                  }}
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
                {(() => {
                  const editSectorRoles = db.roles.filter(
                    (r) => r.defaultSectorId === editingPos.sectorId
                  );
                  return (
                    <select
                      value={
                        editSectorRoles.some((r) => r.id === editingPos.roleId)
                          ? editingPos.roleId
                          : ""
                      }
                      onChange={(e) => setEditingPos({ ...editingPos, roleId: e.target.value })}
                      disabled={editSectorRoles.length === 0}
                      style={ui.select}
                    >
                      {editSectorRoles.length === 0 && (
                        <option value="">Nenhuma função vinculada a este setor</option>
                      )}
                      {editSectorRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  );
                })()}
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
