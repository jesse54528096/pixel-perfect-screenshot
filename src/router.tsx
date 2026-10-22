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
import { BarbersBrowsePage } from "./routes/barbers";
import { BarberDetailPage } from "./routes/barber-detail";
import { MyBookingsPage } from "./routes/my-bookings";
import { BookingSuccessPage } from "./routes/booking-success";
import { RequireAdmin } from "./routes/require-admin";
import { AdminPayoutsPage } from "./routes/admin-payouts";
import { ShopEarningsPage } from "./routes/shop-earnings";

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      { path: "/", element: <Index /> },
      { path: "/sign-in", element: <LoginPage key="signin" mode="signin" /> },
      { path: "/sign-up", element: <LoginPage key="signup" mode="signup" /> },
      // Old URLs from the TanStack Start version.
      { path: "/login", element: <Navigate to="/sign-in" replace /> },
      // Public marketplace: browsing needs no account, booking does.
      { path: "/barbers", element: <BarbersBrowsePage /> },
      { path: "/barbers/:id", element: <BarberDetailPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/home", element: <RoleHome /> },
          { path: "/app", element: <BarbersPage /> },
          { path: "/bookings", element: <MyBookingsPage /> },
          { path: "/bookings/success", element: <BookingSuccessPage /> },
          {
            element: <RequireShop />,
            children: [
              { path: "/shop", element: <ShopSetupPage /> },
              { path: "/shop/bookings", element: <ShopBookingsPage /> },
              { path: "/shop/earnings", element: <ShopEarningsPage /> },
            ],
          },
          {
            element: <RequireAdmin />,
            children: [{ path: "/admin/payouts", element: <AdminPayoutsPage /> }],
          },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
