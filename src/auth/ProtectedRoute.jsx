import { useSession } from './AuthProvider';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const { session } = useSession();
  return session ? children : <Navigate to="/login" />;
}
