/**
 * Loan EMI maths (reducing balance, monthly rests — how Nepali banks quote
 * home loans). Pure functions, shared by the calculator and the unit tests.
 */
export function monthlyEmi(principal: number, annualRatePct: number, months: number): number {
  if (!(principal > 0) || !(months > 0)) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

export type YearRow = { year: number; principalPaid: number; interestPaid: number; balance: number };

export function loanSummary(principal: number, annualRatePct: number, years: number) {
  const months = Math.round(years * 12);
  const emi = monthlyEmi(principal, annualRatePct, months);
  const r = annualRatePct / 12 / 100;
  const schedule: YearRow[] = [];
  let balance = principal;
  let row: YearRow = { year: 1, principalPaid: 0, interestPaid: 0, balance };
  for (let m = 1; m <= months; m++) {
    const interest = balance * r;
    const princ = Math.min(emi - interest, balance);
    balance = Math.max(0, balance - princ);
    row.interestPaid += interest;
    row.principalPaid += princ;
    row.balance = balance;
    if (m % 12 === 0 || m === months) {
      schedule.push(row);
      row = { year: row.year + 1, principalPaid: 0, interestPaid: 0, balance };
    }
  }
  const totalPaid = emi * months;
  return { emi, months, totalPaid, totalInterest: Math.max(0, totalPaid - principal), schedule };
}
