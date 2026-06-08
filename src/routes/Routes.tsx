import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom';
import { TopBar } from '../components/layout/TopBar';
import { BrowsePage } from '../pages/BrowsePage';
import { MyGroupsPage } from '../pages/MyGroupsPage';
import { GroupPage } from '../pages/GroupPage';
import { useIframe } from '../hooks/useIframeListener';

function Layout() {
  useIframe();
  return (
    <>
      <TopBar />
      <Outlet />
    </>
  );
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true,          element: <BrowsePage /> },
      { path: 'my-groups',    element: <MyGroupsPage /> },
      { path: 'group/:id',    element: <GroupPage /> },
    ],
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
