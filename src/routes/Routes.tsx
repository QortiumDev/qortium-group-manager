import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom';
import { TopBar } from '../components/layout/TopBar';
import { BrowsePage } from '../pages/BrowsePage';
import { MyGroupsPage } from '../pages/MyGroupsPage';
import { GroupPage } from '../pages/GroupPage';
import { CreateGroupPage } from '../pages/CreateGroupPage';
import { AddressGroupsPage } from '../pages/AddressGroupsPage';
import { useIframe } from '../hooks/useIframeListener';

const _startRoute = new URLSearchParams(window.location.search).get('_route');
if (_startRoute) window.location.hash = _startRoute;

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
      { index: true,              element: <MyGroupsPage /> },
      { path: 'browse',           element: <BrowsePage /> },
      { path: 'group/:id',        element: <GroupPage /> },
      { path: 'address/:address', element: <AddressGroupsPage /> },
      { path: 'create-group',     element: <CreateGroupPage /> },
    ],
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
