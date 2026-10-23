import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, createHashRouter, Navigate, RouterProvider, useLocation } from 'react-router';
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
import Events, { EventPage } from './pages/Events';
import { CheckIn, EventEditor, ManageEvent, ManageEventList } from './pages/ManageEvents';
import { RahyarAssign, RahyarConversation, RahyarHome, RahyarLearner, RahyarLearners, RahyarMessages, RahyarReport, RahyarReports } from './pages/Rahyar';
import { CorePage, ImamPage, JoinPage, Messages, MyCores, Notifications, OrgList, OrgPage } from './pages/Social';
import RahyarTree from './pages/admin/RahyarTree';
import { AdminSupport, Help, TicketPage } from './pages/Support';
import { AdminBroadcasts, BroadcastPage } from './pages/Broadcast';
import { AccessLogPage, Samples, ToolsAdmin } from './pages/admin/Extra';
import { AdminBusiness } from './pages/Business';
import Toolbox, { BoardPage, PublicBoard, ToolPage } from './pages/Tools';
import { PathExam } from './pages/Learn';
import './styles/app.css';
import { DemoBar } from './demo/DemoBar';

if (savedTheme() !== 'system') applyTheme(savedTheme());

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

const router = (import.meta.env.VITE_DEMO ? createHashRouter : createBrowserRouter)([
  { path: '/login', element: <Login /> },
  { path: '/verify', element: <VerifyPage /> },
  { path: '/verify/:code', element: <VerifyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/b/:token', element: <PublicBoard /> },
  {
    element: <RequireAuth><Shell /></RequireAuth>,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/learn', element: <Learn /> },
      { path: '/paths/:slug', element: <PathPage /> },
      { path: '/paths/:slug/exam', element: <PathExam /> },
      { path: '/help', element: <Help /> },
      { path: '/tools', element: <Toolbox /> },
      { path: '/tools/t/:toolId', element: <ToolPage /> },
      { path: '/tools/boards/:id', element: <BoardPage /> },
      { path: '/support/:id', element: <TicketPage /> },
      { path: '/broadcast', element: <BroadcastPage /> },
      { path: '/courses/:slug', element: <Course /> },
      { path: '/lessons/:id', element: <Lesson /> },
      { path: '/me', element: <Me /> },
      { path: '/settings', element: <Settings /> },
      { path: '/events', element: <Events /> },
      { path: '/events/:id', element: <EventPage /> },
      { path: '/notifications', element: <Notifications /> },
      { path: '/messages', element: <Messages /> },
      { path: '/cores', element: <MyCores /> },
      { path: '/cores/:id', element: <CorePage /> },
      { path: '/join/:code', element: <JoinPage /> },
      { path: '/imam', element: <ImamPage /> },
      { path: '/org', element: <OrgList /> },
      { path: '/org/:id', element: <OrgPage /> },
      { path: '/rahyar', element: <RahyarHome /> },
      { path: '/rahyar/reports', element: <RahyarReports /> },
      { path: '/rahyar/reports/:learnerId/:lessonId', element: <RahyarReport /> },
      { path: '/rahyar/learners', element: <RahyarLearners /> },
      { path: '/rahyar/learners/:id', element: <RahyarLearner /> },
      { path: '/rahyar/messages', element: <RahyarMessages /> },
      { path: '/rahyar/messages/:learnerId', element: <RahyarConversation /> },
      { path: '/rahyar/assign', element: <RahyarAssign /> },
      { path: '/rahyar/tree', element: <RahyarTree /> },
      { path: '/manage/events', element: <ManageEventList /> },
      { path: '/manage/events/new', element: <EventEditor /> },
      { path: '/manage/events/:id', element: <ManageEvent /> },
      { path: '/manage/events/:id/edit', element: <EventEditor /> },
      { path: '/manage/events/:id/checkin', element: <CheckIn /> },
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
      { path: 'business', element: <AdminBusiness /> },
      { path: 'business/:tab', element: <AdminBusiness /> },
      { path: 'courses/:id', element: <CourseEditor /> },
      { path: 'paths', element: <Paths /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'grants', element: <Grants /> },
      { path: 'certificates', element: <Certificates /> },
      { path: 'mosques', element: <Mosques /> },
      { path: 'audit', element: <Audit /> },
      { path: 'rahyar', element: <RahyarTree /> },
      { path: 'support', element: <AdminSupport /> },
      { path: 'support/:id', element: <TicketPage admin /> },
      { path: 'broadcasts', element: <AdminBroadcasts /> },
      { path: 'samples', element: <Samples /> },
      { path: 'tools', element: <ToolsAdmin /> },
      { path: 'security', element: <AccessLogPage /> },
      { path: 'events', element: <ManageEventList /> },
      { path: 'events/new', element: <EventEditor /> },
      { path: 'events/:id', element: <ManageEvent /> },
      { path: 'events/:id/edit', element: <EventEditor /> },
      { path: 'events/:id/checkin', element: <CheckIn /> },
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
          {import.meta.env.VITE_DEMO && <DemoBar />}
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
