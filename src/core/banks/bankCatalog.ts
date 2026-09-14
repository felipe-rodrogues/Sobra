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
    packageNames: ['com.nu.production', 'com.nubank'],
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
    packageNames: ['br.com.gabba.Caixa'],
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
    packageNames: ['br.com.intermedium', 'com.bancointer.bancointer'],
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
    packageNames: ['com.picpay'],
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

export function detectBankByText(text: string, packageName?: string): BankInfo | undefined {
  if (packageName) {
    const byPkg = MAJOR_BANKS.find(b => b.packageNames.includes(packageName));
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
