/**
 * Sobra - Catálogo dos Maiores Bancos e Instituições do Brasil
 * Contém metadados, cores oficiais e package names do Android
 */

export interface BankInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  packageNames: string[];
}

export const MAJOR_BANKS: BankInfo[] = [
  // ─── TIER 1: Grandes Bancos Tradicionais ───────────────────────────────────
  {
    id: 'nubank',
    name: 'Nubank',
    shortName: 'Nubank',
    color: '#820AD1',
    textColor: '#FFFFFF',
    packageNames: ['com.nu.production', 'com.nubank', 'com.nu.beta', 'com.nu.corporate', 'com.nu.business', 'br.com.nubank'],
  },
  {
    id: 'itau',
    name: 'Banco Itaú',
    shortName: 'Itaú',
    color: '#EC7000',
    textColor: '#FFFFFF',
    packageNames: ['com.itau', 'com.itau.personnalite', 'com.itau.cartoes', 'com.iti.iti'],
  },
  {
    id: 'bradesco',
    name: 'Banco Bradesco',
    shortName: 'Bradesco',
    color: '#CC092F',
    textColor: '#FFFFFF',
    packageNames: ['com.bradesco', 'com.bradesco.cartoes', 'br.com.bradesco.next', 'br.com.digio'],
  },
  {
    id: 'bb',
    name: 'Banco do Brasil',
    shortName: 'Banco do Brasil',
    color: '#003882',
    textColor: '#F8D117',
    packageNames: ['br.com.bb.android'],
  },
  {
    id: 'caixa',
    name: 'Caixa Econômica Federal',
    shortName: 'CAIXA',
    color: '#005CA9',
    textColor: '#FFFFFF',
    packageNames: ['br.com.gabba.Caixa', 'br.com.caixa.tem'],
  },
  {
    id: 'santander',
    name: 'Banco Santander',
    shortName: 'Santander',
    color: '#EC0000',
    textColor: '#FFFFFF',
    packageNames: ['com.santander.app', 'com.santander.way'],
  },
  // ─── TIER 2: Fintechs e Bancos Digitais Relevantes ───────────────────────
  {
    id: 'inter',
    name: 'Banco Inter',
    shortName: 'Inter',
    color: '#FF7A00',
    textColor: '#FFFFFF',
    packageNames: ['br.com.intermedium', 'com.bancointer.bancointer', 'br.com.inter', 'br.com.inter.empresas'],
  },
  {
    id: 'c6',
    name: 'C6 Bank',
    shortName: 'C6 Bank',
    color: '#232B2B',
    textColor: '#F8FAFC',
    packageNames: ['com.c6bank.app'],
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    shortName: 'Mercado Pago',
    color: '#00B1EA',
    textColor: '#FFFFFF',
    packageNames: ['com.mercadopago.wallet'],
  },
  {
    id: 'picpay',
    name: 'PicPay',
    shortName: 'PicPay',
    color: '#21C25E',
    textColor: '#FFFFFF',
    packageNames: ['com.picpay', 'com.picpay.wallet', 'com.picpay.business'],
  },
  {
    id: 'btg',
    name: 'BTG Pactual',
    shortName: 'BTG',
    color: '#001E62',
    textColor: '#FFFFFF',
    packageNames: ['com.btg.pactual.banking'],
  },
  {
    id: 'neon',
    name: 'Banco Neon',
    shortName: 'Neon',
    color: '#00C7BE',
    textColor: '#0A0A14',
    packageNames: ['br.com.neon'],
  },
  {
    id: 'pagbank',
    name: 'PagBank',
    shortName: 'PagBank',
    color: '#00A650',
    textColor: '#FFFFFF',
    packageNames: ['br.com.uol.ps.myaccount'],
  },
  {
    id: 'ame',
    name: 'Ame Digital',
    shortName: 'Ame',
    color: '#F23F72',
    textColor: '#FFFFFF',
    packageNames: ['com.amedigital.wallet'],
  },
  {
    id: 'digio',
    name: 'Digio',
    shortName: 'Digio',
    color: '#00427A',
    textColor: '#FFFFFF',
    packageNames: ['br.com.digio'],
  },
  {
    id: 'pan',
    name: 'Banco Pan',
    shortName: 'Pan',
    color: '#F47920',
    textColor: '#FFFFFF',
    packageNames: ['br.com.bancopan'],
  },
  {
    id: 'original',
    name: 'Banco Original',
    shortName: 'Original',
    color: '#00A04A',
    textColor: '#FFFFFF',
    packageNames: ['br.com.original'],
  },
  {
    id: 'xp',
    name: 'XP Investimentos',
    shortName: 'XP',
    color: '#0D0D0D',
    textColor: '#FFFFFF',
    packageNames: ['br.com.xp.cartao', 'com.xpi.cartoes'],
  },
  {
    id: 'iti',
    name: 'iti Itaú',
    shortName: 'iti Itaú',
    color: '#FF4600',
    textColor: '#FFFFFF',
    packageNames: ['com.iti.iti'],
  },
  {
    id: 'sicoob',
    name: 'Sicoob',
    shortName: 'Sicoob',
    color: '#006B3F',
    textColor: '#FFFFFF',
    packageNames: ['br.com.sicoob.sisbrmobile'],
  },
  {
    id: 'sicredi',
    name: 'Sicredi',
    shortName: 'Sicredi',
    color: '#009B3A',
    textColor: '#FFFFFF',
    packageNames: ['br.com.sicredi'],
  },
  {
    id: 'bv',
    name: 'BV - Banco Votorantim',
    shortName: 'BV',
    color: '#0033C6',
    textColor: '#FFFFFF',
    packageNames: ['br.com.bv'],
  },
  {
    id: 'safra',
    name: 'Banco Safra',
    shortName: 'Safra',
    color: '#002060',
    textColor: '#C9A84C',
    packageNames: ['br.com.safra'],
  },
  {
    id: 'next',
    name: 'Banco Next',
    shortName: 'Next',
    color: '#00FF5F',
    textColor: '#0A0A14',
    packageNames: ['br.com.bradesco.next'],
  },
  {
    id: 'sofisa',
    name: 'Sofisa Direto',
    shortName: 'Sofisa',
    color: '#FF6B00',
    textColor: '#FFFFFF',
    packageNames: ['br.com.sofisa.sofisadireto'],
  },
  // ─── CARTEIRA ──────────────────────────────────────────────────────────────
  {
    id: 'cash',
    name: 'Dinheiro em Espécie',
    shortName: 'Carteira',
    color: '#10B981',
    textColor: '#FFFFFF',
    packageNames: [],
  },
];

export function getBankById(id?: string): BankInfo | undefined {
  if (!id) return undefined;
  return MAJOR_BANKS.find(b => b.id.toLowerCase() === id.toLowerCase());
}

/**
 * Identifica o banco com precisão absoluta através do packageName do Android
 */
export function getBankByPackage(packageName?: string): BankInfo | undefined {
  if (!packageName) return undefined;
  const pkgLower = packageName.toLowerCase().trim();

  // 1. Match direto nos packageNames cadastrados
  const directMatch = MAJOR_BANKS.find(b => 
    b.packageNames.some(p => p.toLowerCase() === pkgLower)
  );
  if (directMatch) return directMatch;

  // 2. Heurística inteligente baseada no padrão de pacotes Android
  if (
    pkgLower.includes('intermedium') ||
    pkgLower.includes('bancointer') ||
    pkgLower === 'br.com.inter' ||
    pkgLower.startsWith('br.com.inter.')
  ) {
    return MAJOR_BANKS.find(b => b.id === 'inter');
  }
  if (pkgLower.startsWith('com.nu.') || pkgLower.includes('nubank')) {
    return MAJOR_BANKS.find(b => b.id === 'nubank');
  }
  if (pkgLower.includes('itau') || pkgLower.includes('iti.iti')) {
    return MAJOR_BANKS.find(b => b.id === 'itau');
  }
  if (pkgLower.includes('bradesco')) {
    return MAJOR_BANKS.find(b => b.id === 'bradesco');
  }
  if (pkgLower.includes('santander')) {
    return MAJOR_BANKS.find(b => b.id === 'santander');
  }
  if (pkgLower.includes('c6bank')) {
    return MAJOR_BANKS.find(b => b.id === 'c6');
  }
  if (pkgLower.includes('mercadopago')) {
    return MAJOR_BANKS.find(b => b.id === 'mercadopago');
  }
  if (pkgLower.includes('picpay')) {
    return MAJOR_BANKS.find(b => b.id === 'picpay');
  }
  if (pkgLower.includes('bb.android')) {
    return MAJOR_BANKS.find(b => b.id === 'bb');
  }
  if (pkgLower.includes('caixa')) {
    return MAJOR_BANKS.find(b => b.id === 'caixa');
  }
  if (pkgLower.includes('btg.pactual')) {
    return MAJOR_BANKS.find(b => b.id === 'btg');
  }
  if (pkgLower.includes('neon')) {
    return MAJOR_BANKS.find(b => b.id === 'neon');
  }
  if (pkgLower.includes('pagbank') || pkgLower.includes('uol.ps')) {
    return MAJOR_BANKS.find(b => b.id === 'pagbank');
  }
  if (pkgLower.includes('xp.cartao') || pkgLower.includes('xpi.cartoes')) {
    return MAJOR_BANKS.find(b => b.id === 'xp');
  }
  if (pkgLower.includes('sofisa')) {
    return MAJOR_BANKS.find(b => b.id === 'sofisa');
  }
  if (pkgLower.includes('sicredi')) {
    return MAJOR_BANKS.find(b => b.id === 'sicredi');
  }
  if (pkgLower.includes('sicoob')) {
    return MAJOR_BANKS.find(b => b.id === 'sicoob');
  }
  if (pkgLower.includes('bancopan')) {
    return MAJOR_BANKS.find(b => b.id === 'pan');
  }
  if (pkgLower.includes('amedigital')) {
    return MAJOR_BANKS.find(b => b.id === 'ame');
  }

  return undefined;
}

export function detectBankByText(text: string, packageName?: string): BankInfo | undefined {
  if (packageName) {
    const byPkg = getBankByPackage(packageName);
    if (byPkg) return byPkg;
  }

  const lower = text.toLowerCase();
  for (const bank of MAJOR_BANKS) {
    if (
      lower.includes(bank.id) ||
      lower.includes(bank.name.toLowerCase()) ||
      lower.includes(bank.shortName.toLowerCase())
    ) {
      return bank;
    }
  }
  return undefined;
}
