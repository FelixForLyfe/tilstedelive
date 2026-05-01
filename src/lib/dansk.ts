// Danske datoer/uger uden eksterne biblioteker

const DAGE = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MAANEDER = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

export function formaterDansk(date: Date): string {
  const dag = DAGE[date.getDay()];
  return `${dag.charAt(0).toUpperCase() + dag.slice(1)} d. ${date.getDate()}. ${MAANEDER[date.getMonth()]} ${date.getFullYear()}`;
}

export function formaterKortDato(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}-${date.getFullYear()}`;
}

export function formaterTid(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

/** YYYY-MM-DD i brugerens lokale timezone */
export function dagensDato(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function maanedNavn(maaned0: number): string {
  return MAANEDER[maaned0].charAt(0).toUpperCase() + MAANEDER[maaned0].slice(1);
}
