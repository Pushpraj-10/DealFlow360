/**
 * Money is always handled as integer minor units (cents) to avoid binary
 * floating point drift (PRD NFR-006). Rounding only happens once, at the
 * final money boundary of each calculation.
 */

const utcDayNumber = (date) => {
    const d = new Date(date);
    return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
};

const daysBetweenUTC = (from, to) => utcDayNumber(to) - utcDayNumber(from);

/**
 * remaining_fraction = remaining_days_in_period / total_days_in_period
 * prorated_delta = (new_period_amount - old_period_amount) * remaining_fraction
 * Positive delta => additional charge. Negative delta => credit note.
 */
const computeProratedDeltaCents = ({
    oldUnitPriceCents,
    oldQty,
    newUnitPriceCents,
    newQty,
    periodStart,
    periodEnd,
    effectiveAt,
}) => {
    const totalDays = daysBetweenUTC(periodStart, periodEnd);
    const remainingDays = daysBetweenUTC(effectiveAt, periodEnd);

    if (totalDays <= 0) {
        throw new Error('Invalid billing period: periodEnd must be after periodStart');
    }

    const oldAmountCents = oldUnitPriceCents * oldQty;
    const newAmountCents = newUnitPriceCents * newQty;
    const deltaCents = newAmountCents - oldAmountCents;

    const clampedRemainingDays = Math.min(Math.max(remainingDays, 0), totalDays);

    return Math.round((deltaCents * clampedRemainingDays) / totalDays);
};

const centsToDisplay = (cents, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

export { daysBetweenUTC, computeProratedDeltaCents, centsToDisplay };
