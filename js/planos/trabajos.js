// Trabajos de obra nueva sacados de los planos (paquete por zona), para cargarlos al plan desde la app.
// Cada trabajo: nombre, fase, cantidad y unidad (si el plano la da) y la hoja de donde sale.
// Medidas: AR-06 (planta acotada), AR-09 (acabados y cuadros de puertas y ventanas), AR-11 (cielo y luminarias),
// G-06 (demoliciones). Área del comedor según el trazo del AR-01: 7.48 × 5.35 m ≈ 40 m².
export const PAQUETES = [
  {
    id: "comedor",
    nombre: "Comedor empleados administrativos y taller",
    hojas: "G-06, AR-06, AR-09, AR-11",
    nota: "La casita de block existente se queda y se remodela por dentro. El baño nuevo va en la esquina sureste.",
    punto: [785, 55],   // dónde está en el plano (unidades), para ligarlo a su área
    trabajos: [
      { fase: "Demolición", nombre: "Desmontar cielo falso existente", cantidad: 40, unidad: "m²", hoja: "G-06" },
      { fase: "Demolición", nombre: "Desmontar piso existente", cantidad: 40, unidad: "m²", hoja: "G-06" },
      { fase: "Demolición", nombre: "Desmontar baño existente completo (esquina noreste): artefactos, enchape, cielo y luminarias", hoja: "G-06" },
      { fase: "Demolición", nombre: "Desmontar ventana oeste, puerta y ventana sur", cantidad: 3, unidad: "unidades", hoja: "G-06" },
      { fase: "Demolición", nombre: "Demoler tramo de pared sur para la puerta nueva (junto a la esquina sureste)", hoja: "G-06" },
      { fase: "Obra", nombre: "Paredes del baño nuevo (SS 1.30 × 1.80) de tablaroca o densglass", cantidad: 3.1, unidad: "ml", hoja: "AR-06 / AR-09 (3, 5)" },
      { fase: "Obra", nombre: "Sellar con densglass los huecos de la pared sur (donde estaban la puerta y la ventana)", hoja: "AR-09 (6)" },
      { fase: "Obra", nombre: "Puerta principal PVE-R: puerta de vidrio existente reutilizada y reubicada (1.00 m)", cantidad: 1, unidad: "unidades", hoja: "AR-06 / AR-09" },
      { fase: "Obra", nombre: "Puerta del baño PM-2: metal 0.70 × 2.10, cerrojo, negro satinado", cantidad: 1, unidad: "unidades", hoja: "AR-09" },
      { fase: "Obra", nombre: "Ventana VE existente: revisar, limpiar y dar mantenimiento", cantidad: 1, unidad: "unidades", hoja: "AR-09" },
      { fase: "Acabados", nombre: "Enchape de piso a cielo: baño (tablaroca) y pared de block de la cocineta y el baño", hoja: "AR-09 (5, 7)" },
      { fase: "Acabados", nombre: "Resanar, limpiar y pintar paredes de block existentes", hoja: "AR-09 (6)" },
      { fase: "Acabados", nombre: "Piso de cerámica o porcelanato (comedor y baño)", cantidad: 40, unidad: "m²", hoja: "AR-09 (2)" },
      { fase: "Acabados", nombre: "Cielo falso modular tipo Galaxy (comedor y baño)", cantidad: 40, unidad: "m²", hoja: "AR-09 (B) / AR-11" },
      { fase: "Instalaciones", nombre: "Luminarias: 11 en el comedor, 1 en el baño y 1 afuera de la puerta", cantidad: 13, unidad: "unidades", hoja: "AR-11" },
      { fase: "Instalaciones", nombre: "Cocineta con lavatrastos (esquina noreste)", hoja: "AR-06" },
      { fase: "Instalaciones", nombre: "Inodoro y lavamanos del baño", hoja: "AR-06" },
    ],
  },
  {
    id: "taller-oeste",
    nombre: "Taller · acceso oeste",
    hojas: "G-06, AR-09",
    nota: "Entre la esquina de Tableros eléctricos y la oficina del supervisor. El portón viejo ya se quitó (G-06); ahí va la cortina Sarti.",
    punto: [941, 120],
    trabajos: [
      { fase: "Obra", nombre: "Instalar cortina metálica tipo Sarti (entre la esquina de tableros y la oficina del supervisor)", cantidad: 1, unidad: "unidades", hoja: "AR-09" },
      { fase: "Demolición", nombre: "Desmontar estructura metálica sobre la lámina existente (pared oeste del taller, debajo del supervisor)", hoja: "G-06" },
    ],
  },
];
