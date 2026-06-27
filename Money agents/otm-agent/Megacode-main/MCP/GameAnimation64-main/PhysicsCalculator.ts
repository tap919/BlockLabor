/**
 * PhysicsCalculator.ts
 * Biophysics and general physics calculation utilities for research use.
 *
 * Modules:
 *  - Thermodynamics: entropy, enthalpy, Gibbs free energy, Boltzmann statistics
 *  - Molecular biophysics: sedimentation coefficient, diffusion, Stokes radius
 *  - Electrostatics: Debye length, Coulomb interactions in solution
 *  - Fluid mechanics: Reynolds number, Stokes drag, viscosity
 *  - Radioactive decay: half-life, activity, dose estimation
 *  - Unit conversion helpers (SI ↔ CGS ↔ natural units)
 */

// ─── Physical constants (SI) ──────────────────────────────────────────────────

export const CONSTANTS = {
  /** Boltzmann constant (J/K) */
  kB:       1.380649e-23,
  /** Avogadro constant (mol⁻¹) */
  NA:       6.02214076e23,
  /** Gas constant (J mol⁻¹ K⁻¹) */
  R:        8.314462618,
  /** Elementary charge (C) */
  e:        1.602176634e-19,
  /** Planck constant (J·s) */
  h:        6.62607015e-34,
  /** Speed of light (m/s) */
  c:        2.99792458e8,
  /** Vacuum permittivity (F/m) */
  eps0:     8.8541878128e-12,
  /** Proton mass (kg) */
  mP:       1.67262192369e-27,
  /** Electron mass (kg) */
  mE:       9.1093837015e-31,
  /** 1 Dalton in kg */
  Da:       1.66053906660e-27,
  /** Water viscosity at 20 °C (Pa·s) */
  eta20C:   1.002e-3,
  /** Faraday constant (C/mol) */
  F:        96485.33212,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThermodynamicsResult {
  deltaG_kJmol:   number;  // Gibbs free energy change (kJ/mol)
  deltaH_kJmol:   number;
  deltaS_JmolK:   number;
  equilibriumK:   number;  // dimensionless equilibrium constant
  spontaneous:    boolean;
}

export interface HydrodynamicsResult {
  stokesRadius_m:        number;  // Stokes radius (m)
  diffusionCoeff_m2s:    number;  // translational diffusion coefficient (m²/s)
  sedimentationCoeff_S:  number;  // sedimentation coefficient in Svedberg units
  frictionCoeff_Nsm:     number;  // translational friction coefficient (N·s/m)
}

export interface ElectrostaticsResult {
  debyeLength_m:   number;  // Debye screening length (m)
  coulombEnergy_J: number;  // Coulomb interaction energy (J)
  zetaPotential_V?: number; // zeta potential, if surface charge density given
}

// ─── PhysicsCalculator ────────────────────────────────────────────────────────

export class PhysicsCalculator {

  // ── Thermodynamics ───────────────────────────────────────────────────────────

  /**
   * Gibbs free energy: ΔG = ΔH − T·ΔS
   *
   * @param deltaH_kJmol  Enthalpy change in kJ/mol
   * @param deltaS_JmolK  Entropy change in J/(mol·K)
   * @param tempK         Temperature in Kelvin (default 298.15 K = 25 °C)
   */
  static gibbsFreeEnergy(
    deltaH_kJmol: number,
    deltaS_JmolK: number,
    tempK = 298.15,
  ): ThermodynamicsResult {
    const deltaG_kJmol = deltaH_kJmol - (tempK * deltaS_JmolK) / 1000;
    // ΔG = −RT ln K  →  K = exp(−ΔG / RT)
    const equilibriumK = Math.exp(-(deltaG_kJmol * 1000) / (CONSTANTS.R * tempK));
    return {
      deltaG_kJmol,
      deltaH_kJmol,
      deltaS_JmolK,
      equilibriumK,
      spontaneous: deltaG_kJmol < 0,
    };
  }

  /**
   * Van't Hoff equation: ΔG° = −RT ln K
   * Compute ΔG from an equilibrium constant at a given temperature.
   */
  static gibbsFromK(K: number, tempK = 298.15): number {
    return -(CONSTANTS.R * tempK * Math.log(K)) / 1000;  // kJ/mol
  }

  /**
   * Boltzmann factor: probability ratio P₂/P₁ = exp(−ΔE / kBT)
   *
   * @param energyDiff_J  Energy difference ΔE in Joules
   */
  static boltzmannFactor(energyDiff_J: number, tempK = 298.15): number {
    return Math.exp(-energyDiff_J / (CONSTANTS.kB * tempK));
  }

  /**
   * DNA/RNA melting temperature (Tm) using the Wallace rule (for oligos ≤ 14 nt).
   * For longer sequences uses the nearest-neighbor approximation (simplified).
   *
   * @param seq         DNA sequence (5' → 3')
   * @param saltM       Monovalent salt concentration (mol/L, default 50 mM)
   */
  static meltingTemperature(seq: string, saltM = 0.05): number {
    const s = seq.toUpperCase().replace(/\s/g, '');
    const A = (s.match(/A/g) ?? []).length;
    const T = (s.match(/T/g) ?? []).length;
    const G = (s.match(/G/g) ?? []).length;
    const C = (s.match(/C/g) ?? []).length;

    if (s.length <= 14) {
      // Wallace rule: Tm = 2(A+T) + 4(G+C) (°C, 0.05 M Na+)
      return 2 * (A + T) + 4 * (G + C);
    }
    // Marmur–Doty for longer sequences with salt correction
    const gcFrac  = (G + C) / s.length;
    const tmBase  = 81.5 + 16.6 * Math.log10(saltM) + 41 * gcFrac - 675 / s.length;
    return Math.round(tmBase * 10) / 10;
  }

  // ── Molecular Hydrodynamics ──────────────────────────────────────────────────

  /**
   * Stokes–Einstein equation for diffusion coefficient of a sphere.
   * D = kBT / (6πηr)
   *
   * @param radius_m  Hydrodynamic radius in metres
   * @param viscosity_Pas  Solvent viscosity (Pa·s, default: water at 20 °C)
   * @param tempK     Temperature (K)
   */
  static diffusionCoefficient(radius_m: number, viscosity_Pas = CONSTANTS.eta20C, tempK = 293.15): number {
    return (CONSTANTS.kB * tempK) / (6 * Math.PI * viscosity_Pas * radius_m);
  }

  /**
   * Svedberg equation: sedimentation coefficient.
   * s = M(1 − ν̄ρ) / (NA · f)
   * where f = 6πηr (friction for a sphere)
   *
   * @param mass_Da         Molecular mass in Daltons
   * @param partialSpec_m3kg  Partial specific volume (m³/kg, typical protein ≈ 7.4e-4)
   * @param radius_m        Stokes radius (m)
   * @param solventDensity_kgm3  Solvent density (kg/m³, water = 997)
   * @param viscosity_Pas   Solvent viscosity
   * @param tempK           Temperature (K)
   */
  static sedimentationCoefficient(
    mass_Da:             number,
    partialSpec_m3kg     = 7.4e-4,
    radius_m:            number,
    solventDensity_kgm3  = 997,
    viscosity_Pas        = CONSTANTS.eta20C,
    tempK                = 293.15,
  ): HydrodynamicsResult {
    const mass_kg      = mass_Da * CONSTANTS.Da;
    const buoyancyTerm = 1 - partialSpec_m3kg * solventDensity_kgm3;
    const f            = 6 * Math.PI * viscosity_Pas * radius_m;
    const s_SI         = (mass_kg * buoyancyTerm) / (CONSTANTS.NA * f);
    const D            = PhysicsCalculator.diffusionCoefficient(radius_m, viscosity_Pas, tempK);

    return {
      stokesRadius_m:       radius_m,
      diffusionCoeff_m2s:   D,
      sedimentationCoeff_S: s_SI / 1e-13,   // convert to Svedberg (1 S = 10⁻¹³ s)
      frictionCoeff_Nsm:    f,
    };
  }

  /**
   * Estimate the Stokes radius from molecular mass using an empirical power law
   * (valid for globular proteins):  r ≈ 0.066 × M^0.333  (nm, M in Da)
   */
  static stokesRadiusEstimate_m(mass_Da: number): number {
    return 0.066e-9 * Math.pow(mass_Da, 1 / 3);
  }

  // ── Electrostatics ───────────────────────────────────────────────────────────

  /**
   * Debye screening length: λD = sqrt(ε₀εᵣkBT / (2NAe²I))
   *
   * @param ionicStrength_M  Ionic strength I (mol/L)
   * @param dielectricConst  Relative permittivity (default 78.4 for water at 25 °C)
   * @param tempK            Temperature (K)
   */
  static debyeLength(ionicStrength_M: number, dielectricConst = 78.4, tempK = 298.15): number {
    const I_SI = ionicStrength_M * 1000;  // mol/m³
    return Math.sqrt(
      (CONSTANTS.eps0 * dielectricConst * CONSTANTS.kB * tempK) /
      (2 * CONSTANTS.NA * CONSTANTS.e ** 2 * I_SI),
    );
  }

  /**
   * Coulomb interaction energy between two point charges in a medium:
   * U = q₁q₂ / (4πε₀εᵣr)
   *
   * @param charge1  First charge in units of elementary charge
   * @param charge2  Second charge in units of elementary charge
   * @param distance_m  Distance between charges (m)
   * @param dielectricConst  Relative permittivity
   */
  static coulombEnergy(
    charge1:        number,
    charge2:        number,
    distance_m:     number,
    dielectricConst = 78.4,
  ): number {
    const q1 = charge1 * CONSTANTS.e;
    const q2 = charge2 * CONSTANTS.e;
    return (q1 * q2) / (4 * Math.PI * CONSTANTS.eps0 * dielectricConst * distance_m);
  }

  // ── Radioactive decay ────────────────────────────────────────────────────────

  /**
   * Radioactive decay: N(t) = N₀ × exp(−λt),  λ = ln2 / t½
   *
   * @param initialActivity_Bq  Initial activity in Becquerel
   * @param halfLife_s          Half-life in seconds
   * @param time_s              Elapsed time in seconds
   * @returns Activity at time t (Bq)
   */
  static radioactiveDecay(initialActivity_Bq: number, halfLife_s: number, time_s: number): number {
    const lambda = Math.log(2) / halfLife_s;
    return initialActivity_Bq * Math.exp(-lambda * time_s);
  }

  // ── Reynolds number ──────────────────────────────────────────────────────────

  /**
   * Reynolds number: Re = ρvL / η
   * Indicates laminar (Re < ~2300) vs turbulent (Re > ~4000) flow.
   *
   * @param velocity_ms         Flow velocity (m/s)
   * @param characteristicLen_m Characteristic length (e.g., channel width, particle diameter) (m)
   * @param density_kgm3        Fluid density (kg/m³, water = 997)
   * @param viscosity_Pas       Dynamic viscosity (Pa·s)
   */
  static reynoldsNumber(
    velocity_ms:          number,
    characteristicLen_m:  number,
    density_kgm3          = 997,
    viscosity_Pas         = CONSTANTS.eta20C,
  ): number {
    return (density_kgm3 * velocity_ms * characteristicLen_m) / viscosity_Pas;
  }

  // ── Unit conversions ─────────────────────────────────────────────────────────

  static kelvinToCelsius(K: number): number { return K - 273.15; }
  static celsiusToKelvin(C: number): number { return C + 273.15; }

  /** Convert energy in kJ/mol to kBT units at given temperature. */
  static kJmolToKbt(kJmol: number, tempK = 298.15): number {
    return (kJmol * 1000) / (CONSTANTS.kB * tempK * CONSTANTS.NA);
  }

  /** Convert nanometres to metres. */
  static nmToM(nm: number): number { return nm * 1e-9; }

  /** Convert Ångströms to metres. */
  static angToM(ang: number): number { return ang * 1e-10; }
}
