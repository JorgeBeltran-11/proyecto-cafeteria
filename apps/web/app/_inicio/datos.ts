/**
 * Datos editables de las páginas informativas (/cafes, /domicilio, /pedidos, /equipo, /conocenos).
 * Contenido estático (no viene de la API). Los importes van en centavos de dólar.
 */

/** Formatea centavos como "$1.50" (punto decimal, como en los precios de la cafetería). */
export function dolares(centavos: number): string {
  return `$${(centavos / 100).toFixed(2)}`;
}

/* ---------- Navegación ---------- */

export const NAVEGACION = [
  { href: "/", texto: "Inicio" },
  { href: "/cafes", texto: "Menú" },
  { href: "/pedidos", texto: "Carrito de compras" },
  { href: "/equipo", texto: "Personal" },
] as const;

export type RutaNavegacion = (typeof NAVEGACION)[number]["href"] | "/conocenos" | "/domicilio";

/* ---------- Pie de página ---------- */

/** Datos de contacto de la cafetería: cámbialos aquí y se actualizan en todo el sitio. */
export const CONTACTO = {
  direccion: "Campus UTPL, San Cayetano Alto, Loja",
  horario: ["Lunes a viernes: 07:00–19:00", "Sábados: 08:00–13:00"],
  telefono: { texto: "(07) 257 3864", enlace: "tel:+59372573864" },
  whatsapp: { texto: "099 482 6157", enlace: "https://wa.me/593994826157" },
  correo: "hola@cafeteriacampus.ec",
} as const;

export const EXPLORA = [
  { href: "/cafes", texto: "Nuestros cafés" },
  { href: "/domicilio", texto: "Servicio a domicilio" },
  { href: "/conocenos", texto: "Conoce nuestra historia" },
  { href: "/equipo", texto: "Nuestro equipo" },
] as const;

/* ---------- /cafes ---------- */

export type Cafe = {
  id: string;
  nombre: string;
  descripcion: string;
  precioCentavos: number;
  imagen: string;
  alt: string;
};

export const CAFES: Cafe[] = [
  {
    id: "espresso",
    nombre: "Espresso",
    descripcion: "Un trago corto e intenso de café de Loja, con crema dorada y final a cacao.",
    precioCentavos: 150,
    imagen: "/inicio/cafes/espresso.svg",
    alt: "Ilustración de un espresso en una taza pequeña con su platito",
  },
  {
    id: "americano",
    nombre: "Americano",
    descripcion: "Espresso alargado con agua caliente: suave, aromático y para tomar sin prisa.",
    precioCentavos: 175,
    imagen: "/inicio/cafes/americano.svg",
    alt: "Ilustración de un americano en una taza alta de café negro",
  },
  {
    id: "capuchino",
    nombre: "Capuchino",
    descripcion: "Espresso, leche vaporizada y una capa generosa de espuma con cacao espolvoreado.",
    precioCentavos: 250,
    imagen: "/inicio/cafes/capuchino.svg",
    alt: "Ilustración de un capuchino con espuma alta y cacao espolvoreado",
  },
  {
    id: "latte",
    nombre: "Latte",
    descripcion: "Mucha leche cremosa sobre un espresso doble, coronado con arte latte.",
    precioCentavos: 275,
    imagen: "/inicio/cafes/latte.svg",
    alt: "Ilustración de un latte en vaso de vidrio con capas de café, leche y espuma",
  },
  {
    id: "mocaccino",
    nombre: "Mocaccino",
    descripcion: "Espresso con chocolate y leche, terminado con crema batida y hilos de cacao.",
    precioCentavos: 300,
    imagen: "/inicio/cafes/mocaccino.svg",
    alt: "Ilustración de un mocaccino con crema batida y salsa de chocolate",
  },
];

/* ---------- /domicilio ---------- */

export const SERVICIO_DOMICILIO = {
  intro:
    "Llevamos tu café, tus desayunos y tus antojos hasta tu aula, tu oficina o tu casa. Preparamos cada pedido al momento y lo enviamos en empaques térmicos para que llegue como recién servido.",
  detalles: [
    {
      titulo: "Zonas",
      texto:
        "Campus UTPL (edificios, bibliotecas y laboratorios) y barrios de Loja hasta 5 km alrededor del campus.",
    },
    {
      titulo: "Horario",
      texto: "Lunes a viernes de 07:00 a 19:00. Sábados de 08:00 a 13:00.",
    },
    {
      titulo: "Tiempo estimado",
      texto: "De 15 a 25 minutos dentro del campus y de 30 a 45 minutos en el resto de zonas.",
    },
    {
      titulo: "Cómo pedir",
      texto:
        "Escríbenos por WhatsApp con lo que quieres, tu dirección y tu forma de pago (efectivo, transferencia o tarjeta). Te confirmamos el total y el tiempo de llegada.",
    },
  ],
};

export type CostoEnvio = { zona: string; detalle: string; costoCentavos: number };

export const COSTOS_ENVIO: CostoEnvio[] = [
  { zona: "Dentro del campus", detalle: "Edificios y áreas de la UTPL", costoCentavos: 50 },
  { zona: "Hasta 2 km", detalle: "Barrios cercanos al campus", costoCentavos: 150 },
  { zona: "De 2 a 5 km", detalle: "Resto de la zona de cobertura", costoCentavos: 250 },
];

export const PEDIDO_MINIMO_CENTAVOS = 500;

/** Mensajes y respuestas automáticas del chat de pedidos. */
export const CHAT = {
  bienvenida: [
    "¡Hola! Te saluda la Cafetería UTPL ☕",
    "¿En qué te podemos ayudar? Elige una opción o escríbenos tu pregunta.",
  ],
  respuestasRapidas: [
    { id: "costos", texto: "Ver costos" },
    { id: "horario", texto: "Horario" },
    { id: "pedido", texto: "Hacer un pedido" },
  ],
  respuestas: {
    costos:
      "Envío dentro del campus: $0.50. Hasta 2 km: $1.50. De 2 a 5 km: $2.50. El pedido mínimo es de $5.00.",
    horario: "Atendemos a domicilio de lunes a viernes de 07:00 a 19:00 y los sábados de 08:00 a 13:00.",
    pedido:
      "¡Perfecto! Cuéntanos qué te gustaría, tu dirección (o edificio del campus) y cómo vas a pagar: efectivo, transferencia o tarjeta.",
    saludo: "¡Hola! ¿Qué se te antoja hoy? Puedes preguntarnos por costos, horario o hacer un pedido.",
    gracias: "¡Con gusto! Que disfrutes tu café ☕",
    otro: "Gracias por escribirnos. Una persona de nuestro equipo te responderá en unos minutos.",
  },
} as const;

export type IdRespuesta = keyof typeof CHAT.respuestas;

/** Elige la respuesta automática según palabras clave del mensaje. */
export function responderChat(mensaje: string): IdRespuesta {
  const t = mensaje
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/(costo|precio|envio|cuanto|valor|minimo)/.test(t)) return "costos";
  if (/(horario|hora|abren|cierran|atienden)/.test(t)) return "horario";
  if (/(pedido|pedir|quiero|ordenar|comprar)/.test(t)) return "pedido";
  if (/(gracias|genial|excelente)/.test(t)) return "gracias";
  if (/(hola|buenas|buenos)/.test(t)) return "saludo";
  return "otro";
}

/* ---------- /pedidos ---------- */

export const ESTADOS_PEDIDO = ["Recibido", "En preparación", "Listo", "Entregado"] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export type Pedido = {
  numero: string;
  cliente: string;
  productos: { nombre: string; cantidad: number }[];
  totalCentavos: number;
  hora: string;
  estado: EstadoPedido;
};

export const PEDIDOS: Pedido[] = [
  {
    numero: "1042",
    cliente: "Valeria Jiménez",
    productos: [
      { nombre: "Capuchino", cantidad: 2 },
      { nombre: "Croissant", cantidad: 1 },
    ],
    totalCentavos: 650,
    hora: "07:45",
    estado: "Entregado",
  },
  {
    numero: "1043",
    cliente: "Mateo Castillo",
    productos: [{ nombre: "Espresso", cantidad: 1 }],
    totalCentavos: 150,
    hora: "08:10",
    estado: "Entregado",
  },
  {
    numero: "1044",
    cliente: "Camila Rojas",
    productos: [
      { nombre: "Latte", cantidad: 1 },
      { nombre: "Humita", cantidad: 2 },
    ],
    totalCentavos: 575,
    hora: "08:32",
    estado: "Listo",
  },
  {
    numero: "1045",
    cliente: "Sebastián Paredes",
    productos: [
      { nombre: "Americano", cantidad: 2 },
      { nombre: "Tamal lojano", cantidad: 2 },
    ],
    totalCentavos: 750,
    hora: "08:51",
    estado: "En preparación",
  },
  {
    numero: "1046",
    cliente: "Ana Lucía Vivanco",
    productos: [{ nombre: "Mocaccino", cantidad: 1 }],
    totalCentavos: 300,
    hora: "09:05",
    estado: "En preparación",
  },
  {
    numero: "1047",
    cliente: "Diego Granda",
    productos: [
      { nombre: "Capuchino", cantidad: 1 },
      { nombre: "Espresso", cantidad: 1 },
      { nombre: "Bolón de verde", cantidad: 1 },
    ],
    totalCentavos: 700,
    hora: "09:18",
    estado: "Recibido",
  },
  {
    numero: "1048",
    cliente: "Paula Ordóñez",
    productos: [{ nombre: "Latte", cantidad: 2 }],
    totalCentavos: 550,
    hora: "09:24",
    estado: "Recibido",
  },
];

/* ---------- /equipo ---------- */

export type Integrante = {
  nombre: string;
  cargo: string;
  edad: number;
  antiguedad: string;
  texto: string;
};

export const EQUIPO: Integrante[] = [
  {
    nombre: "Carlos Andrés Jaramillo",
    cargo: "Barista",
    edad: 27,
    antiguedad: "4 años",
    texto: "Tuesta y calibra el café cada mañana. Su especialidad: el capuchino con arte latte.",
  },
  {
    nombre: "Gabriela Torres Ochoa",
    cargo: "Cajera",
    edad: 22,
    antiguedad: "1 año y medio",
    texto: "Recibe los pedidos y los pagos con una sonrisa, incluso en la hora pico del almuerzo.",
  },
  {
    nombre: "Luis Fernando Cueva",
    cargo: "Pastelero",
    edad: 34,
    antiguedad: "5 años",
    texto: "Hornea los croissants, las humitas y los dulces de la vitrina antes de que abramos.",
  },
  {
    nombre: "María José Armijos",
    cargo: "Administradora",
    edad: 31,
    antiguedad: "6 años",
    texto: "Organiza turnos, proveedores y menús. Estuvo en el primer local desde la apertura.",
  },
  {
    nombre: "Jhonny Paúl Sarango",
    cargo: "Repartidor",
    edad: 24,
    antiguedad: "2 años",
    texto: "Conoce cada edificio del campus y cada atajo de Loja para que tu café llegue caliente.",
  },
];

/** Iniciales del nombre y primer apellido, p. ej. "Carlos Andrés Jaramillo" → "CJ". */
export function iniciales(nombre: string): string {
  const partes = nombre.split(" ").filter(Boolean);
  const primera = partes[0]?.[0] ?? "";
  const ultima = partes.length > 2 ? partes[2][0] : (partes[1]?.[0] ?? "");
  return `${primera}${ultima}`.toUpperCase();
}

/* ---------- /conocenos ---------- */

export const ANIO_FUNDACION = 2019;

export const HISTORIA = [
  {
    anio: "2018",
    titulo: "Nace la idea",
    texto:
      "Un grupo de estudiantes de la UTPL, cansados de no encontrar buen café en el campus, se propuso servir café de Loja de calidad a sus compañeros, comprado directamente a productores de la provincia.",
  },
  {
    anio: "2019",
    titulo: "Fundación",
    texto:
      "Abrimos con un pequeño carrito de café en el campus: una máquina de espresso, dos termos y muchas ganas.",
  },
  {
    anio: "2021",
    titulo: "Nuestro primer local",
    texto:
      "Con la vuelta a las aulas inauguramos el primer local, con mesas para estudiar y conversar.",
  },
  {
    anio: "2022",
    titulo: "Menú de desayunos",
    texto:
      "Sumamos desayunos con sabor lojano: humitas, tamales, bolones y pan recién horneado.",
  },
  {
    anio: "2024",
    titulo: "Servicio a domicilio",
    texto:
      "Empezamos a llevar pedidos a las aulas, oficinas y barrios cercanos al campus.",
  },
];

export const MISION =
  "Servir café de Loja de calidad y comida preparada al momento a la comunidad universitaria, con un trato cercano y precios justos para estudiantes.";

export const VISION =
  "Ser la cafetería de referencia de los campus del sur del Ecuador, reconocida por su café de origen, su servicio ágil y su compromiso con los productores locales.";

export const VALORES = [
  { titulo: "Calidad", texto: "Granos seleccionados de fincas lojanas y recetas cuidadas." },
  { titulo: "Cercanía", texto: "Conocemos a nuestros clientes por su nombre y su pedido." },
  { titulo: "Comercio justo", texto: "Pagamos un precio digno a los productores de la provincia." },
  { titulo: "Responsabilidad", texto: "Reducimos plásticos y cuidamos los datos de quienes nos eligen." },
];
