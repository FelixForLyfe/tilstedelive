export type OrgType =
  | "skole_sfo"
  | "sportsklub"
  | "fitnesscenter"
  | "spejder"
  | "daginstitution"
  | "andet";

export type Terms = {
  deltager: string;
  deltagere: string;
  gruppe: string;
  grupper: string;
  aktivitet: string;
  aktiviteter: string;
  leder: string;
  tjekInd: string;
  tjekUd: string;
  hjemsendelse: string;
  visCpr: boolean;
};

const TERMS: Record<OrgType, Terms> = {
  skole_sfo: {
    deltager: "barn",
    deltagere: "børn",
    gruppe: "klasse",
    grupper: "klasser",
    aktivitet: "aktivitet",
    aktiviteter: "aktiviteter",
    leder: "lærer",
    tjekInd: "tjek ind",
    tjekUd: "send hjem",
    hjemsendelse: "hjemsendelse",
    visCpr: true,
  },
  daginstitution: {
    deltager: "barn",
    deltagere: "børn",
    gruppe: "gruppe",
    grupper: "grupper",
    aktivitet: "aktivitet",
    aktiviteter: "aktiviteter",
    leder: "pædagog",
    tjekInd: "tjek ind",
    tjekUd: "send hjem",
    hjemsendelse: "hjemsendelse",
    visCpr: true,
  },
  sportsklub: {
    deltager: "medlem",
    deltagere: "medlemmer",
    gruppe: "hold",
    grupper: "hold",
    aktivitet: "træning",
    aktiviteter: "træninger",
    leder: "træner",
    tjekInd: "tjek ind",
    tjekUd: "tjek ud",
    hjemsendelse: "afgang",
    visCpr: false,
  },
  fitnesscenter: {
    deltager: "medlem",
    deltagere: "medlemmer",
    gruppe: "hold",
    grupper: "hold",
    aktivitet: "session",
    aktiviteter: "sessioner",
    leder: "instruktør",
    tjekInd: "tjek ind",
    tjekUd: "tjek ud",
    hjemsendelse: "afgang",
    visCpr: false,
  },
  spejder: {
    deltager: "spejder",
    deltagere: "spejdere",
    gruppe: "patrulje",
    grupper: "patruljer",
    aktivitet: "møde",
    aktiviteter: "møder",
    leder: "spejderleder",
    tjekInd: "mød op",
    tjekUd: "gå hjem",
    hjemsendelse: "hjemsendelse",
    visCpr: false,
  },
  andet: {
    deltager: "deltager",
    deltagere: "deltagere",
    gruppe: "gruppe",
    grupper: "grupper",
    aktivitet: "aktivitet",
    aktiviteter: "aktiviteter",
    leder: "leder",
    tjekInd: "tjek ind",
    tjekUd: "tjek ud",
    hjemsendelse: "afgang",
    visCpr: false,
  },
};

export function getTerms(type: OrgType | null | undefined): Terms {
  return TERMS[type ?? "andet"];
}

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  skole_sfo: "Skole / SFO",
  daginstitution: "Privat daginstitution",
  sportsklub: "Sportsklub",
  fitnesscenter: "Fitnesscenter",
  spejder: "Spejder / Ungdomsforening",
  andet: "Andet",
};
