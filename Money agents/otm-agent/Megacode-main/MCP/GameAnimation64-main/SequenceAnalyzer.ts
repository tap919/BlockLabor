/**
 * SequenceAnalyzer.ts
 * Utilities for analyzing biological sequences (DNA, RNA, protein).
 *
 * Covers:
 *  - Sequence type detection
 *  - Basic statistics: GC content, nucleotide composition, molecular weight
 *  - Translation (DNA → protein) using standard genetic code
 *  - Reverse complement
 *  - ORF (Open Reading Frame) detection
 *  - Simple motif search
 *  - Codon usage table
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SequenceType = 'DNA' | 'RNA' | 'PROTEIN' | 'UNKNOWN';

export interface SequenceStats {
  type:            SequenceType;
  length:          number;
  /** GC percentage (0–100). Defined for DNA/RNA only; NaN for protein. */
  gcContent:       number;
  /** Composition map: nucleotide/amino-acid → count */
  composition:     Record<string, number>;
  /** Estimated molecular weight in Da (average isotopic masses). */
  molecularWeight: number;
  /** Isoelectric point estimate (protein only, NaN otherwise). */
  isoelectricPoint: number;
}

export interface Orf {
  start:   number;  // 0-based index in the input sequence
  end:     number;  // exclusive
  strand:  '+' | '-';
  frame:   0 | 1 | 2;
  protein: string;
  length:  number;  // aa length
}

export interface MotifMatch {
  position:  number;  // 0-based
  match:     string;
}

// ─── Genetic code (standard, NCBI table 1) ────────────────────────────────────

const GENETIC_CODE: Record<string, string> = {
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L',
  CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
  ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
  TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
  CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*',
  CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
  GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
  CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
};

// Average monoisotopic molecular weights for nucleotides (dNMP, Da)
const DNA_MW: Record<string, number> = { A: 313.21, T: 304.19, G: 329.21, C: 289.18 };
const RNA_MW: Record<string, number> = { A: 329.21, U: 306.17, G: 345.21, C: 305.18 };
// Average residue masses for amino acids (Da) — residue = AA minus water
const AA_MW: Record<string, number> = {
  A: 71.08,  R: 156.19, N: 114.10, D: 115.09, C: 103.14,
  Q: 128.13, E: 129.12, G: 57.05,  H: 137.14, I: 113.16,
  L: 113.16, K: 128.17, M: 131.20, F: 147.18, P: 97.12,
  S: 87.08,  T: 101.10, W: 186.21, Y: 163.18, V: 99.13,
};

// pKa values used for rough isoelectric point estimation
const AA_PKA: Record<string, { pKa: number; charge: number }> = {
  D: { pKa: 3.65,  charge: -1 },
  E: { pKa: 4.25,  charge: -1 },
  C: { pKa: 8.18,  charge: -1 },
  Y: { pKa: 10.07, charge: -1 },
  H: { pKa: 6.00,  charge: +1 },
  K: { pKa: 10.53, charge: +1 },
  R: { pKa: 12.48, charge: +1 },
};

// ─── SequenceAnalyzer ─────────────────────────────────────────────────────────

export class SequenceAnalyzer {

  /**
   * Auto-detect the type of a biological sequence from its characters.
   */
  static detectType(seq: string): SequenceType {
    const upper = seq.toUpperCase().replace(/\s/g, '');
    if (!upper.length) return 'UNKNOWN';
    const dnaChars  = /^[ACGTN\-]+$/;
    const rnaChars  = /^[ACGUN\-]+$/;
    const aaChars   = /^[ACDEFGHIKLMNPQRSTVWY\*\-]+$/;
    if (dnaChars.test(upper) && !upper.includes('U')) return 'DNA';
    if (rnaChars.test(upper)) return 'RNA';
    if (aaChars.test(upper))  return 'PROTEIN';
    return 'UNKNOWN';
  }

  /**
   * Compute basic statistics for a biological sequence.
   */
  static analyze(rawSeq: string): SequenceStats {
    const seq  = rawSeq.toUpperCase().replace(/\s/g, '');
    const type = SequenceAnalyzer.detectType(seq);

    // Composition
    const composition: Record<string, number> = {};
    for (const ch of seq) {
      composition[ch] = (composition[ch] ?? 0) + 1;
    }

    // GC content
    let gcContent = NaN;
    if (type === 'DNA' || type === 'RNA') {
      const gc = (composition['G'] ?? 0) + (composition['C'] ?? 0);
      gcContent = seq.length > 0 ? (gc / seq.length) * 100 : 0;
    }

    // Molecular weight
    let molecularWeight = 18.02; // water correction for linear chain
    if (type === 'DNA') {
      for (const [base, count] of Object.entries(composition)) {
        molecularWeight += (DNA_MW[base] ?? 0) * count;
      }
    } else if (type === 'RNA') {
      for (const [base, count] of Object.entries(composition)) {
        molecularWeight += (RNA_MW[base] ?? 0) * count;
      }
    } else if (type === 'PROTEIN') {
      for (const [aa, count] of Object.entries(composition)) {
        molecularWeight += (AA_MW[aa] ?? 0) * count;
      }
    }

    // Isoelectric point (protein only)
    const isoelectricPoint = type === 'PROTEIN'
      ? SequenceAnalyzer.estimatePi(seq)
      : NaN;

    return { type, length: seq.length, gcContent, composition, molecularWeight, isoelectricPoint };
  }

  /**
   * Translate a DNA or RNA sequence into a protein sequence.
   * Uses reading frame `frame` (0, 1, or 2).
   * Returns the translated sequence up to (but not including) the first stop codon.
   */
  static translate(seq: string, frame: 0 | 1 | 2 = 0): string {
    let s = seq.toUpperCase().replace(/\s/g, '').replace(/U/g, 'T');
    let protein = '';
    for (let i = frame; i + 2 < s.length; i += 3) {
      const codon = s.slice(i, i + 3);
      const aa = GENETIC_CODE[codon] ?? 'X';
      if (aa === '*') break;
      protein += aa;
    }
    return protein;
  }

  /**
   * Compute the reverse complement of a DNA sequence.
   */
  static reverseComplement(seq: string): string {
    const complement: Record<string, string> = {
      A: 'T', T: 'A', G: 'C', C: 'G', N: 'N',
      a: 't', t: 'a', g: 'c', c: 'g', n: 'n',
    };
    return seq.split('').reverse().map(b => complement[b] ?? b).join('');
  }

  /**
   * Find all ORFs (Met → Stop) in both strands, minimum `minLength` amino acids.
   */
  static findOrfs(seq: string, minLength = 20): Orf[] {
    const dna = seq.toUpperCase().replace(/\s/g, '').replace(/U/g, 'T');
    const rc  = SequenceAnalyzer.reverseComplement(dna);
    const orfs: Orf[] = [];

    const scanStrand = (strand: string, strandLabel: '+' | '-') => {
      for (const frame of [0, 1, 2] as const) {
        let inOrf   = false;
        let orfStart = 0;
        let protein  = '';

        for (let i = frame; i + 2 < strand.length; i += 3) {
          const codon = strand.slice(i, i + 3);
          const aa    = GENETIC_CODE[codon] ?? 'X';

          if (!inOrf && aa === 'M') {
            inOrf    = true;
            orfStart = i;
            protein  = 'M';
          } else if (inOrf) {
            if (aa === '*') {
              if (protein.length >= minLength) {
                const start = strandLabel === '+'
                  ? orfStart
                  : seq.length - (orfStart + (protein.length + 1) * 3);
                orfs.push({
                  start,
                  end:    start + protein.length * 3,
                  strand: strandLabel,
                  frame,
                  protein,
                  length: protein.length,
                });
              }
              inOrf   = false;
              protein = '';
            } else {
              protein += aa;
            }
          }
        }
      }
    };

    scanStrand(dna, '+');
    scanStrand(rc,  '-');
    return orfs.sort((a, b) => b.length - a.length);
  }

  /**
   * Search for a motif (regex or literal string) in a sequence.
   */
  static findMotif(seq: string, motif: string | RegExp): MotifMatch[] {
    const matches: MotifMatch[] = [];
    const re = typeof motif === 'string'
      ? new RegExp(motif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      : new RegExp(motif.source, motif.flags.includes('g') ? motif.flags : motif.flags + 'g');

    let m: RegExpExecArray | null;
    while ((m = re.exec(seq)) !== null) {
      matches.push({ position: m.index, match: m[0] });
    }
    return matches;
  }

  /**
   * Build a codon usage table from a DNA/RNA sequence.
   * Returns a map of codon → { count, amino acid, frequency (fraction of synonymous codons) }.
   */
  static codonUsage(seq: string): Map<string, { codon: string; aa: string; count: number; relFreq: number }> {
    const s = seq.toUpperCase().replace(/\s/g, '').replace(/U/g, 'T');
    const counts = new Map<string, number>();

    for (let i = 0; i + 2 < s.length; i += 3) {
      const codon = s.slice(i, i + 3);
      if (GENETIC_CODE[codon]) counts.set(codon, (counts.get(codon) ?? 0) + 1);
    }

    // Group by amino acid to compute relative frequency
    const byAA: Record<string, number> = {};
    for (const [codon, cnt] of counts) {
      const aa = GENETIC_CODE[codon] ?? '?';
      byAA[aa] = (byAA[aa] ?? 0) + cnt;
    }

    const result = new Map<string, { codon: string; aa: string; count: number; relFreq: number }>();
    for (const [codon, count] of counts) {
      const aa     = GENETIC_CODE[codon] ?? '?';
      const relFreq = byAA[aa] ? count / byAA[aa] : 0;
      result.set(codon, { codon, aa, count, relFreq });
    }
    return result;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /** Rough isoelectric point estimation via charge balance method. */
  private static estimatePi(protein: string): number {
    const counts: Record<string, number> = {};
    for (const aa of protein.toUpperCase()) {
      counts[aa] = (counts[aa] ?? 0) + 1;
    }

    // N-terminus pKa ~8.0, C-terminus pKa ~3.1 (average values)
    const nTermPka = 8.0;
    const cTermPka = 3.1;

    const chargeAtPH = (ph: number): number => {
      let charge = 0;
      // Positive: N-term + His + Lys + Arg
      charge += 1 / (1 + Math.pow(10, ph - nTermPka));
      for (const [aa, pkaInfo] of Object.entries(AA_PKA)) {
        const cnt = counts[aa] ?? 0;
        if (cnt === 0) continue;
        if (pkaInfo.charge > 0) {
          charge += cnt * (1 / (1 + Math.pow(10, ph - pkaInfo.pKa)));
        } else {
          charge -= cnt * (1 / (1 + Math.pow(10, pkaInfo.pKa - ph)));
        }
      }
      // C-terminus is negative
      charge -= 1 / (1 + Math.pow(10, cTermPka - ph));
      return charge;
    };

    // Binary search for zero crossing
    let lo = 0, hi = 14;
    for (let iter = 0; iter < 100; iter++) {
      const mid = (lo + hi) / 2;
      if (chargeAtPH(mid) > 0) lo = mid;
      else                      hi = mid;
    }
    return Math.round(((lo + hi) / 2) * 100) / 100;
  }
}
