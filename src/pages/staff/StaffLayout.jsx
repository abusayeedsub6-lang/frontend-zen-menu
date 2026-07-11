import { Outlet } from 'react-router-dom';
import '../../styles/staff.css';
import '../../styles/staff-embedded.css';

export default function StaffLayout() {
  return (
    <div className="staff-shell">
      <Outlet />
    </div>
  );
}
