// =============================================================================
// POLÍTICA CORPORATIVA DE SENHAS — WORKFORCE ERP UNIÃO SUPERMERCADOS
// Avalia força, complexidade, contexto pessoal e bloqueio de senhas comuns.
// Complementada no backend pelo GoTrue (`minimum_password_length = 12` + classes)
// e pela proteção contra senhas vazadas (HaveIBeenPwned / HIBP no Supabase Auth).
// =============================================================================

const COMMON_OR_COMPROMISED_PASSWORDS = new Set([
  "123456789012", "1234567890123", "123456789abc", "000000000000", "111111111111",
  "qwertyuiop12", "qwerty123456", "asdfghjkl123", "zxcvbnm12345", "1q2w3e4r5t6y",
  "password1234", "password@123", "passw0rd1234", "p@ssw0rd1234", "welcome12345",
  "welcome@2026", "welcome@2025", "welcome@2024", "changeme1234", "changeme@123",
  "letmein12345", "iloveyou1234", "sunshine1234", "princess1234", "football1234",
  "baseball1234", "dragon123456", "master123456", "master@12345", "monkey123456",
  "shadow123456", "superman1234", "batman123456", "trustno11234", "whatever1234",
  "abc123456789", "abcd12345678", "abcdef123456", "987654321098", "123123123123",
  "admin1234567", "admin@123456", "admin@2026!!", "administrador", "administrador1",
  "administrador@1", "root12345678", "suporte12345", "suporte@1234", "suporte@2026",
  "sistema12345", "sistema@2026", "operador1234", "operador@123", "gerente12345",
  "gerente@2026", "diretoria123", "diretoria@12", "financeiro12", "financeiro@1",
  "recursos1234", "colaborador1", "trabalhador1", "funcionario1", "seguranca123",
  "senha1234567", "senha@123456", "senha123456!", "minhasenha12", "minhasenha@1",
  "mudarsenha12", "mudar@123456", "trocar123456", "novasenha123", "novasenha@12",
  "senhaforte12", "senhaforte@1", "acesso123456", "acesso@12345", "brasil123456",
  "brasil@2026!", "minasgerais1", "uberaba12345", "uberlandia12", "campoflorido",
  "campoflorido1", "conceicao123", "uniaosuper12", "uniao1234567", "uniao@123456",
  "uniao@2024!!", "uniao@2025!!", "uniao@2026!!", "uniao2026!!!", "uniaosupermercados",
  "supermercado", "supermercado1", "supermercados", "escala123456", "escala@12345",
  "escalafolga1", "workforce123", "workforce@12", "loja01123456", "loja02123456",
  "loja03123456", "loja03@2026!", "loja01@2026!", "loja02@2026!", "yuara1234567",
  "primavera123", "outono123456", "inverno12345", "verao1234567", "janeiro12345",
  "fevereiro123", "setembro2026", "outubro@2026", "novembro2026", "dezembro2026",
  "deusefiel123", "jesusmeama12", "jesuscristo1", "familia12345", "vitoria12345",
  "sucesso12345", "felicidade12", "esperanca123", "liberdade123", "estrela12345",
  "flamengo1234", "corinthians1", "palmeiras123", "cruzeiro1234", "atletico1234",
  "aaabbbccc123", "112233445566", "qazwsxedcrfv", "1qaz2wsx3edc", "zaq12wsxcde3",
]);

const BANNED_SUBSTRINGS = [
  "senha123",
  "uniao123",
  "uniao202",
  "admin123",
  "qwertyui",
  "asdfghjk",
  "12345678",
  "87654321",
];

function hasTrivialSequenceOrRepeat(pwd) {
  if (!pwd) return false;
  // 4+ caracteres idênticos seguidos (ex.: "aaaa", "1111", "!!!!")
  if (/(.)\1{3,}/.test(pwd)) return true;

  const lower = pwd.toLowerCase();
  const sequences = [
    "abcdefghijklmnopqrstuvwxyz",
    "zyxwvutsrqponmlkjihgfedcba",
    "01234567890",
    "09876543210",
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
  ];
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 5; i++) {
      const slice = seq.slice(i, i + 5);
      if (lower.includes(slice)) return true;
    }
  }
  return false;
}

function containsPersonalContext(pwd, { email = "", fullName = "" } = {}) {
  const lower = String(pwd || "").toLowerCase();
  if (!lower) return false;

  const emailLocal = String(email || "")
    .trim()
    .toLowerCase()
    .split("@")[0];
  if (emailLocal && emailLocal.length >= 3 && lower.includes(emailLocal)) {
    return true;
  }

  const tokens = [
    ...emailLocal.split(/[._+-]+/),
    ...String(fullName || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/),
  ].filter((t) => t.length >= 4);

  return tokens.some((tok) => lower.includes(tok));
}

function isCommonPassword(pwd) {
  const raw = String(pwd || "").trim().toLowerCase();
  if (!raw) return false;
  if (COMMON_OR_COMPROMISED_PASSWORDS.has(raw)) return true;
  // Normaliza substituições leet óbvias (@->a, 0->o, 1->i, 3->e, $->s) para barrar "Senh@1234567"
  const deleeted = raw
    .replace(/@/g, "a")
    .replace(/0/g, "o")
    .replace(/3/g, "e")
    .replace(/\$/g, "s");
  if (COMMON_OR_COMPROMISED_PASSWORDS.has(deleeted)) return true;
  return BANNED_SUBSTRINGS.some((sub) => raw.includes(sub) || deleeted.includes(sub));
}

/**
 * Avalia uma senha candidata contra a política corporativa.
 * @param {string} password
 * @param {{ email?: string, fullName?: string }} [context]
 * @returns {{ valid: boolean, score: number, strengthLabel: string, rules: Array<{id:string, label:string, ok:boolean}> }}
 */
export function evaluatePassword(password, context = {}) {
  const pwd = String(password || "");
  const hasMinLen = pwd.length >= 8;
  const hasMaxLen = pwd.length <= 128;
  const hasUpper = /[A-ZÀ-Ý]/.test(pwd);
  const hasLower = /[a-zà-ÿ]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSymbol = /[^A-Za-zÀ-ÿ0-9\s]/.test(pwd);
  const noSpacesOnly = pwd.length > 0 && pwd.trim().length === pwd.length;
  const notPersonal = pwd.length > 0 && !containsPersonalContext(pwd, context);
  const notCommon = pwd.length > 0 && !isCommonPassword(pwd) && !hasTrivialSequenceOrRepeat(pwd);

  const rules = [
    { id: "min_length", label: "Mínimo de 8 caracteres", ok: hasMinLen && hasMaxLen },
    { id: "uppercase", label: "Pelo menos uma letra maiúscula (A–Z)", ok: hasUpper },
    { id: "lowercase", label: "Pelo menos uma letra minúscula (a–z)", ok: hasLower },
    { id: "digit", label: "Pelo menos um número (0–9)", ok: hasDigit },
    { id: "symbol", label: "Pelo menos um símbolo especial (!@#$%&*...)", ok: hasSymbol },
    { id: "no_personal", label: "Não conter seu nome ou parte do e-mail", ok: notPersonal },
    {
      id: "not_common",
      label: "Não usar senhas comuns, sequências ou repetições óbvias",
      ok: notCommon && noSpacesOnly,
    },
  ];

  const passedCount = rules.filter((r) => r.ok).length;
  const valid = passedCount === rules.length;

  let score = 0;
  if (pwd.length > 0) {
    score = Math.min(4, Math.floor((passedCount / rules.length) * 4));
    if (valid && pwd.length >= 16) score = 5;
  }

  const labels = ["Muito fraca", "Fraca", "Insuficiente", "Razoável", "Forte", "Muito forte"];
  return {
    valid,
    score,
    strengthLabel: labels[score] || "Insuficiente",
    rules,
  };
}
