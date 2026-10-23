import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router';
import { Shell } from './components/Shell';
import { Spinner, ToastProvider } from './components/ui';
import { ApiError } from './lib/api';
import { AuthProvider, useAuth } from './lib/auth';
import AdminShell from './pages/admin/AdminShell';
import CourseEditor from './pages/admin/CourseEditor';
import Courses from './pages/admin/Courses';
import Dashboard from './pages/admin/Dashboard';
import { Audit, Certificates, Grants, Mosques, Paths, UsersPage } from './pages/admin/Manage';
import Course from './pages/Course';
import Home from './pages/Home';
import Learn, { PathPage } from './pages/Learn';
import Lesson from './pages/Lesson';
import Login from './pages/Login';
import Me from './pages/Me';
import { NotFound, RouteError, TermsPage, VerifyPage } from './pages/Public';
import Settings, { applyTheme, savedTheme } from './pages/Settings';
import './styles/app.css';

applyTheme(savedTheme());

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2 },
  },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}
function RequireStaff({ children }: { children: ReactNode }) {
  const { isStaff } = useAuth();
  return isStaff ? <>{children}</> : <NotFound />;
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/verify', element: <VerifyPage /> },
  { path: '/verify/:code', element: <VerifyPage /> },
  { path: '/terms', element: <TermsPage /> },
  {
    element: <RequireAuth><Shell /></RequireAuth>,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/learn', element: <Learn /> },
      { path: '/paths/:slug', element: <PathPage /> },
      { path: '/courses/:slug', element: <Course /> },
      { path: '/lessons/:id', element: <Lesson /> },
      { path: '/me', element: <Me /> },
      { path: '/settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/admin',
    element: <RequireAuth><RequireStaff><AdminShell /></RequireStaff></RequireAuth>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'courses', element: <Courses /> },
      { path: 'courses/:id', element: <CourseEditor /> },
      { path: 'paths', element: <Paths /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'grants', element: <Grants /> },
      { path: 'certificates', element: <Certificates /> },
      { path: 'mosques', element: <Mosques /> },
      { path: 'audit', element: <Audit /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
