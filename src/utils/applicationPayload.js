/**
 * ============================================================================
 * applicationPayload.js — Phase 3 form ↔ applications row conversion
 * ----------------------------------------------------------------------------
 * Pure helpers (no React, no Supabase) so the legacy-column guarantees can be
 * unit tested:
 *   • every legacy field is always present with its historical default;
 *   • `term` is derived from season + year but manual legacy text still wins;
 *   • new columns are sent as null/number/boolean, never undefined/NaN;
 *   • UI-only state (country, progress, documents...) is never sent to the DB.
 * ============================================================================
 */
import { zonedInputToUtcIso } from './timezone.js'
import {
  DEGREE_LEVELS, TERM_SEASONS, PLATFORMS, ROUNDS, FIT_OPTIONS,
  DEADLINE_KINDS, INTERVIEW_TYPES, REQUIREMENT_STATUSES, AID_POLICIES,
  AID_PERIODS, CURRENCIES, COUNTRIES,
} from './applicationRequirements.js'

export function defaultApplicationForm() {
  return {
    university: '', universityId: null, campus: '', program: '', major: '',
    degreeLevel: '', termSeason: '', termYear: '', deferredEntry: false, term: '',
    platform: '', round: '', isBinding: false,
    portalUrl: '', portalEmail: '', applicantId: '', portalActivated: false,
    feeAmount: '', feeCurrency: 'USD', feeWaiverRequested: false,
    feeWaiverGranted: false, feePaidOn: '',
    fit: '', fitReason: '', acceptanceRate: '',
    whyCourses: '', whyProfessors: '', whyPrograms: '', whyLinks: '',
    progressPercent: 0,
    status: 'Not Started', decision: 'Pending', recommendation: 'Pending',
    notes: '', visibility: 'private', deadline: '',
    decisionConditions: '', decisionAtDate: '', replyDeadlineDate: '',
    replyDeadlineTime: '', replyDeadlineTz: '', committedAtDate: '',
    aidScholarshipName: '', aidAmount: '', aidCurrency: 'USD', aidPeriod: '',
    aidRenewalConditions: '', netCostPerYear: '', aidPolicy: '',
    country: '',
  }
}

const str = (v) => (v === '' || v === null || v === undefined ? null : String(v))
const num = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const dateAtNoonUtc = (d) => (d ? `${d}T12:00:00.000Z` : null)

/** Form → store payload. `appId` is omitted for a new application. */
export function applicationFormToPayload(f, appId) {
  const term = f.termSeason && f.termYear ? `${f.termSeason} ${f.termYear}` : (f.term || '')
  return {
    id: appId || undefined,
    university: f.university || '', program: f.program || '', major: f.major || '',
    term, deadline: f.deadline || null,
    status: f.status || 'Not Started', decision: f.decision || 'Pending',
    recommendation: f.recommendation || 'Pending', notes: f.notes || '',
    visibility: f.visibility || 'private',
    universityId: f.universityId || null,
    campus: str(f.campus), degreeLevel: str(f.degreeLevel),
    termSeason: str(f.termSeason), termYear: num(f.termYear),
    deferredEntry: Boolean(f.deferredEntry),
    platform: str(f.platform), round: str(f.round), isBinding: Boolean(f.isBinding),
    portalUrl: str(f.portalUrl), portalEmail: str(f.portalEmail),
    applicantId: str(f.applicantId), portalActivated: Boolean(f.portalActivated),
    feeAmount: num(f.feeAmount), feeCurrency: str(f.feeCurrency),
    feeWaiverRequested: Boolean(f.feeWaiverRequested),
    feeWaiverGranted: Boolean(f.feeWaiverGranted), feePaidOn: str(f.feePaidOn),
    fit: str(f.fit), fitReason: str(f.fitReason), acceptanceRate: num(f.acceptanceRate),
    whyCourses: str(f.whyCourses), whyProfessors: str(f.whyProfessors),
    whyPrograms: str(f.whyPrograms), whyLinks: str(f.whyLinks),
    decisionConditions: str(f.decisionConditions),
    decisionAt: dateAtNoonUtc(f.decisionAtDate),
    replyDeadlineAt: zonedInputToUtcIso(f.replyDeadlineDate, f.replyDeadlineTime, f.replyDeadlineTz || 'UTC'),
    replyDeadlineTz: str(f.replyDeadlineTz),
    committedAt: dateAtNoonUtc(f.committedAtDate),
    aidScholarshipName: str(f.aidScholarshipName), aidAmount: num(f.aidAmount),
    aidCurrency: str(f.aidCurrency), aidPeriod: str(f.aidPeriod),
    aidRenewalConditions: str(f.aidRenewalConditions),
    netCostPerYear: num(f.netCostPerYear), aidPolicy: str(f.aidPolicy),
  }
}

/** All option keys used by the form must exist in the DB CHECK constraints. */
export const APPLICATION_OPTION_KEYS = {
  degreeLevels: DEGREE_LEVELS.map((o) => o.key),
  termSeasons: TERM_SEASONS,
  platforms: PLATFORMS.map((o) => o.key),
  rounds: ROUNDS.map((o) => o.key),
  fits: FIT_OPTIONS.map((o) => o.key),
  deadlineKinds: DEADLINE_KINDS.map((o) => o.key),
  interviewTypes: INTERVIEW_TYPES.map((o) => o.key),
  requirementStatuses: REQUIREMENT_STATUSES.map((o) => o.key),
  aidPolicies: AID_POLICIES.map((o) => o.key),
  aidPeriods: AID_PERIODS.map((o) => o.key),
  currencies: CURRENCIES,
  countries: COUNTRIES.map((o) => o.key),
}
