import { createBrowserRouter, Navigate, type RouteObject } from "react-router";

import { RootLayout, RootErrorBoundary, NotFound } from "./routes/root";
import { RequireAuth } from "./routes/require-auth";
import { Index } from "./routes/index";
import { LoginPage } from "./routes/login";
import { BarbersPage } from "./routes/app";
import { RoleHome } from "./routes/home";
import { RequireShop } from "./routes/require-shop";
import { ShopSetupPage } from "./routes/shop";
import { ShopBookingsPage } from "./routes/shop-bookings";

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      { path: "/", element: <Index /> },
      { path: "/sign-in", element: <LoginPage mode="signin" /> },
      { path: "/sign-up", element: <LoginPage mode="signup" /> },
      // Old URLs from the TanStack Start version.
      { path: "/login", element: <Navigate to="/sign-in" replace /> },
      { path: "/barbers", element: <Navigate to="/app" replace /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/home", element: <RoleHome /> },
          { path: "/app", element: <BarbersPage /> },
          {
            element: <RequireShop />,
            children: [
              { path: "/shop", element: <ShopSetupPage /> },
              { path: "/shop/bookings", element: <ShopBookingsPage /> },
            ],
          },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
