import { ROLE_DETAIL_FIELDS, roleDetails, type RoleDetails as Details } from './role-details';

export default function RoleDetails({ role }: { role: Details }) {
  const details = roleDetails(role);
  if (!Object.keys(details).length) return null;
  return <dl className="rz-role-detail-display">{ROLE_DETAIL_FIELDS.map(({ key, label }) => details[key] && <div key={key}><dt>{label}</dt><dd>{details[key]}</dd></div>)}</dl>;
}