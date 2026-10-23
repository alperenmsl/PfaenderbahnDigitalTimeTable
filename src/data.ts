import { Employee, ShiftColor, ScheduleData, DayEvent } from "./types";

export const SHIFT_COLORS: Record<
  ShiftColor,
  { bg: string; text: string; label: string }
> = {
  gelb: { bg: "#FFEB3B", text: "#000000", label: "Gelb" },
  rot: { bg: "#F44336", text: "#FFFFFF", label: "Rot" },
  blau: { bg: "#2196F3", text: "#FFFFFF", label: "Blau" },
  gruen: { bg: "#8BC34A", text: "#000000", label: "Grün (Kassa)" },
  pink: { bg: "#FF9FD8", text: "#000000", label: "Pink (Corina)" },
  dunkelLila: { bg: "#7B1FA2", text: "#FFFFFF", label: "Dunkel Lila (Birke)" },
  hellLila: { bg: "#CE93D8", text: "#000000", label: "Hell Lila (Marlies)" },
  beige: { bg: "#F5DEB3", text: "#000000", label: "Beige" },
  betriebsleiter: { bg: "#FF8C00", text: "#FFFFFF", label: "Betriebsleiter" },
  frei: { bg: "#FFFFFF", text: "#000000", label: "Frei" },
  krank: { bg: "#B0BEC5", text: "#FFFFFF", label: "Krank" },
  urlaub: { bg: "#E0E0E0", text: "#000000", label: "Urlaub" },
  ou: { bg: "#FFECB3", text: "#000000", label: "O/U" },
  feiertag: { bg: "#FFF59D", text: "#000000", label: "Feiertag" },
  sonstiges: { bg: "#ECEFF1", text: "#000000", label: "Sonstiges" },
};

const PFAENDER_IMG = "https://www.pfaenderbahn.at/wp-content/uploads/";
const avatar = (file: string) => `${PFAENDER_IMG}${file}`;

export const EMPLOYEES: Employee[] = [
  {
    id: "1",
    name: "Berthold MARTAN",
    allowedColors: ["betriebsleiter", "gelb", "rot", "blau", "gruen"],
    isAdmin: true,
    avatarUrl: avatar("berthold-martan-1.webp"),
  },
  {
    id: "3",
    name: "Alexander Meyer",
    allowedColors: ["gelb", "rot", "blau", "gruen"],
    avatarUrl: avatar("alexander-meyer-1.webp"),
  },
  {
    id: "2",
    name: "Josef GASSER",
    allowedColors: ["gelb", "rot", "blau", "gruen", "krank"],
    avatarUrl: avatar("josef-gasser-1.webp"),
  },
  {
    id: "4",
    name: "Alperen Meseli",
    allowedColors: ["blau", "gelb", "rot", "gruen", "frei", "krank", "urlaub"],
    avatarUrl: avatar("alperen-meseli-praktikant-1.webp"),
  },
  {
    id: "5",
    name: "Matthias MARSCHIK",
    allowedColors: ["gelb", "rot", "blau", "gruen"],
    avatarUrl: avatar("matthias-marschik-1.webp"),
  },
  {
    id: "6",
    name: "Bernhard Dobler",
    allowedColors: ["gelb", "rot", "blau", "gruen"],
    avatarUrl: avatar("bernhard-dobler-1.webp"),
  },
  {
    id: "7",
    name: "Raimund Kreuter",
    allowedColors: ["gelb", "rot", "blau", "gruen"],
    avatarUrl: avatar("raimund-kreuter-himmel.webp"),
  },
  {
    id: "8",
    name: "Mario Mähr",
    allowedColors: ["gelb", "rot", "blau", "gruen"],
    avatarUrl: avatar("mario-mahr-1.webp"),
  },
  {
    id: "9",
    name: "Köstl Rudolf",
    allowedColors: ["gruen", "gelb", "rot", "blau"],
    avatarUrl: avatar("rudi-kostl-1.webp"),
  },
  {
    id: "10",
    name: "Filiz AKTUNA",
    allowedColors: ["gruen", "krank", "urlaub", "frei"],
    avatarUrl: avatar("filiz-aktuna-1.webp"),
  },
  {
    id: "11",
    name: "Margot KONRAD",
    allowedColors: ["gruen", "krank", "urlaub", "frei"],
    avatarUrl: avatar("margot-konrad-1.webp"),
  },
  {
    id: "12",
    name: "Corinna Seiter",
    allowedColors: ["pink", "urlaub", "frei", "krank"],
    avatarUrl: avatar("corinna-seiter-1.webp"),
  },
  {
    id: "13",
    name: "Birke Nußbaumer",
    allowedColors: ["dunkelLila", "urlaub", "frei", "krank"],
    avatarUrl: avatar("birke-nussbaumer-neu.webp"),
  },
  {
    id: "14",
    name: "Klimmer Marlies",
    allowedColors: ["hellLila", "urlaub", "frei", "krank"],
    avatarUrl: avatar("marlies-klimmer-1.webp"),
  },
  {
    id: "15",
    name: "Palta Nadire",
    allowedColors: ["beige", "ou", "frei", "krank"],
    avatarUrl: avatar("nadire-palta-2.webp"),
  },
  {
    id: "16",
    name: "Daniela Hubmann",
    allowedColors: ["beige", "gruen", "ou", "frei", "krank"],
    avatarUrl: avatar("daniela-hubmann-2.webp"),
  },
  {
    id: "17",
    name: "Oberparleiter Michaela",
    allowedColors: ["beige", "ou", "frei", "krank"],
    avatarUrl: avatar("michaela-oberparleiter-1.webp"),
  },
];

export function generateDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  const [day, month, year] = startDate.split("/").map(Number);
  const current = new Date(year, month - 1, day);
  for (let i = 0; i < count; i++) {
    const d = new Date(current);
    d.setDate(current.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
}

export function getMondayOfDate(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function generateWeekDates(fromMonday: string): string[] {
  return generateDates(fromMonday, 7);
}

export function addWeeks(dateStr: string, weeks: number): string {
  const [day, month, year] = dateStr.split("/").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + weeks * 7);
  return formatDate(d);
}

export function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateDisplay(dateStr: string): string {
  const [day, month, year] = dateStr.split("/");
  return `${day}.${month}.${year}`;
}

export function getWeekday(dateStr: string): string {
  const [day, month, year] = dateStr.split("/").map(Number);
  const d = new Date(year, month - 1, day);
  const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return weekdays[d.getDay()];
}

export function createEmptySchedule(
  dates: string[],
  employees: Employee[],
): ScheduleData {
  const schedule: ScheduleData = {};
  for (const emp of employees) {
    schedule[emp.id] = {};
    for (const date of dates) {
      schedule[emp.id][date] = { color: "frei" };
    }
  }
  return schedule;
}

const INITIAL_DATES = generateDates("01/08/2026", 31);

export const INITIAL_SCHEDULE: ScheduleData = createEmptySchedule(
  INITIAL_DATES,
  EMPLOYEES,
);

export const INITIAL_EVENTS: DayEvent[] = [];
