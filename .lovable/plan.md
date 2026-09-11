# Complete Time & Pay payroll workflow

## What will change
- Add an admin-only **Payroll setup** tab inside Time & Pay for each team member’s employee/contractor status, province, pay frequency, TD1 claims, exemptions, vacation pay, and extra withholding.
- Keep **Run payroll** tied to the selected pay period and approved timesheets, but prevent stub generation when a person is not configured instead of silently using defaults.
- Add a **My pay stubs** view for each signed-in team member, with period details, gross pay, deductions, net pay, payment status, and PDF download.
- Refresh payroll results immediately after settings are saved so the run uses the latest profile values.

## Validation
- Verify admin navigation between timesheet, approvals, payroll setup, and payroll run.
- Verify configured profiles drive deduction calculations and generated records.
- Verify employees can only read and download their own pay stubs.
- Check the final app build and the key desktop workflow.

## Technical details
- Reuse the existing payroll profile, tax-year, pay-stub tables, deduction calculator, and PDF generator.
- Preserve existing database access controls; make a schema change only if testing reveals an access gap.
- Keep payroll controls admin-only while exposing personal pay-stub history to the signed-in owner.
