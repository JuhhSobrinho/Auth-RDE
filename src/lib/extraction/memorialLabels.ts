// Rótulos do memorial de cálculo (Composite Repair Specification + Composite
// Design Assessment, base ISO 24817). Documento sempre tem texto real
// extraível — nunca precisa de fallback de IA (ver docs/regras-de-comparacao.md).

export const MEM_LABELS = {
  lineIdentity: "Line Identity:",
  lineDiameter: "Line Diameter:",
  lineOriginalWallThickness: "Line original wall thickness:",
  repairDesignPressure: "Repair Design Pressure:",
  repairDesignTemperature: "Repair Design Temperature:",
  repairConditions: "Repair Conditions:",
  surfaceApplicationTemperature: "Surface Application Temperature:",
  surfacePrepNear: "Surface Preparation Near Defect:",
  surfacePrepAway: "Surface Preparation Away From Defect:",
  repairSystem: "Repair System:",
  repairThickness: "Repair Thickness:",
  requiredOverlap: "Required Overlap:",
  requiredTaper: "Required Taper:",
  customerSpecifiedRepairLength: "Customer specified repair length:",

  operator: "Operator:",
  location: "Location:",
  equipmentLineId: "Equipment / Line ID:",
  engineeringId: "Engineering ID:",
  projectId: "Project ID:",

  lineContents: "Line Contents:",
  lineMaterial: "Line Material:",
  designPressureSystem: "Design Pressure:",
  maxDesignTemperature: "Maximum Design Temperature:",
  minDesignTemperature: "Minimum Design Temperature:",
  operatingPressure: "Operating Pressure:",
  maxOperatingTemperature: "Maximum Operating Temperature:",
  minOperatingTemperature: "Minimum Operating Temperature:",

  axialDefectLength: "Axial Defect Length:",
  circumferentialDefectLength: "Circumferential Defect Length:",
  lengthRequestedRequired: "Length Requested / Required:",
  defectType: "Defect Type:",

  designPressureInternal: "Design Pressure (Internal):",
  designMinRemainingWall: "Design Minimum Remaining Wall Thickness:",

  minInstallSurfaceTempA: "Minimum Installation Surface Temperature:",
  maxInstallSurfaceTempA: "Maximum Installation Surface Temperature:",
  minInstallSurfaceTempB: "Minimum Allowable Installation Temperature:",
  maxInstallSurfaceTempB: "Maximum Installation Temperature:",
} as const;

// Rótulos que existem no documento mas não mapeamos pra nenhum campo do
// MemorialData — precisam entrar na lista mesmo assim, só como "marcador de
// fronteira", senão o parser de posição (extrairPorRotulos) engole o texto
// deles inteiro como se fosse valor do rótulo anterior.
const MEM_ROTULOS_FRONTEIRA = [
  "Site:",
  "Unit:",
  "Routing:",
  "Status:",
  "Design Basis Summary:",
  "Type A Basis:",
  "Type B Basis:",
  "Solution Check:",
  "Design Conditions:",
  "Material System:",
  "Min. Req. Length:",
  "Req. Overlap Past Defect(s):",
  "Required Total Overlap:",
  "Installation Condition:",
  "Pressure during Application:",
  "Surface Application Temp:",
  "Near Defect Surface Prep:",
  "Away Defect Surface Prep:",
  "Defect Cause:",
  "Allowable Defect:",
  "Cure:",
  "Acceptable Defect Size:",
  "Fairing of defect",
  "Cure requirement:",
  "Special installation instructions/precautions",
  "Typical Service:",
  "Specification/Grade:",
  "Approx. Age of Component Known?",
  "Original Wall Thickness of Damaged Line:",
  "Current Wall Thickness of Damaged Line:",
  "Will the Line Experience an External Pressure or Vacuum?",
  "Is an MAWP for Corroded Line Specified By Client",
  "Pressure Cycling (for N>7000 cycles during design life)?",
  "Additional Applied Loads?",
  "Buried Pipe?",
  "Defect Location:",
  'Has or will a "stop gap" been installed within the defect area?',
  "Design Lifetime:",
  'Class (set to "Class 1" for occasional loads per 7.5.5):',
  "Design Pressure Condition:",
  "Design Temperature Condition:",
  "Design Pressure (External):",
  "Design Temperature:",
  "Design Minimum Remaining Wall Thickness:",
  "Wall Loss:",
  "System Installation Condition:",
  "Minimum Installation Pressure:",
  "Maximum Installation Pressure:",
  "Minimum Pressure Following Installation:",
  "External Diameter:",
  "Original Wall Thickness:",
  "Minimum Remaining Wall Thickness:",
  "Stiffness:",
  "SMYS:",
  "Allowable Stress:",
  "CTE:",
  "MAWP (determined with defect) specified by client :",
  "Thickness per Ply",
  "Tensile Modulus in Axial Direction",
  "Tensile Modulus in Circumferential Direction",
  "CTE in Axial Direction",
  "CTE in Circumferential Direction",
  "Lap Shear Strength",
  "Poisson's Ratio for Composite Loaded in Circumferential Direction",
  "Internal Design Pressure:",
  "External Design Pressure:",
  "Maximum Installation Temperature:",
  "PROPRIETARY INFORMATION",
  "Document No.",
];

export const MEM_TODOS_ROTULOS = [...new Set([...Object.values(MEM_LABELS), ...MEM_ROTULOS_FRONTEIRA])];

// Padrões específicos que não seguem o formato simples "Rótulo: Valor".
export const MEM_REGEX = {
  minReqLength: /Min\.?\s*Req\.?\s*Length:\s*([\d.,]+)\s*mm\s*Required\s*\|\s*([\d.,]+)\s*mm\s*Requested/i,
  requiredTotalOverlap: /Required Total Overlap:\s*([\d.,]+)\s*mm\s*Required\s*\|\s*([\d.,]+)\s*mm\s*Available/i,
  availableRequiredOverlapPastDefect: /Available\s*\/\s*Required Overlap Past Defect\s+([\d.,]+)\s*mm/i,
  humidity: /Humidity\s*<\s*(\d+)%/i,
  straightLayers: /Straight\s+(\d+)\s*layers?/i,
  elbowLayers: /Elbows?\s+(\d+)\s*layers?/i,
  materialSystem: /Material System:?\s*\n?\s*([A-Z0-9-]+)/,
  // Conteúdo da linha "Type B Basis:" no quadro "Design Basis Summary" — vem
  // preenchido (método + nº de equação, ex. "Circumferential Slot 13, 14")
  // só quando o memorial exige um cálculo de defeito passante/vazamento;
  // fica vazio quando o defeito é só estrutural. Ver "Furo na linha" em
  // compare.ts.
  typeBBasisConteudo: /Type B Basis:\s*\r?\n([\s\S]*?)\r?\nDesign Overview:/,
};
