import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar.jsx'
import { Footer } from './components/layout/Footer.jsx'
import { CartDrawer } from './components/cart/CartDrawer.jsx'
import { AdminLayout } from './components/layout/AdminLayout.jsx'
import { trackPageView } from './lib/session.js'

// Storefront pages
import { Home }          from './pages/storefront/Home.jsx'
import { Products }      from './pages/storefront/Products.jsx'
import { ProductDetail } from './pages/storefront/ProductDetail.jsx'
import { Collections }   from './pages/storefront/Collections.jsx'
import { Wishlist }      from './pages/storefront/Wishlist.jsx'
import { Checkout }      from './pages/storefront/Checkout.jsx'
import { About }         from './pages/storefront/About.jsx'
import { Contact }       from './pages/storefront/Contact.jsx'
import { Account }       from './pages/storefront/Account.jsx'
import { PolicyPage }    from './pages/storefront/PolicyPage.jsx'

// Admin pages
import { AdminLogin }       from './pages/admin/Login.jsx'
import { AdminDashboard }   from './pages/admin/Dashboard.jsx'
import { AdminProductViews } from './pages/admin/ProductViews.jsx'
import { AdminHomepage }    from './pages/admin/Homepage.jsx'
import { AdminProducts }    from './pages/admin/Products.jsx'
import { AdminInventory }   from './pages/admin/Inventory.jsx'
import { AdminCategories }  from './pages/admin/Categories.jsx'
import { AdminCollections } from './pages/admin/CollectionsAdmin.jsx'
import { AdminBanners }     from './pages/admin/Banners.jsx'
import { AdminVideos }      from './pages/admin/Videos.jsx'
import { AdminReviews }     from './pages/admin/Reviews.jsx'
import { AdminGallery }     from './pages/admin/Gallery.jsx'
import { AdminOrders }      from './pages/admin/Orders.jsx'
import { AdminReports }     from './pages/admin/Reports.jsx'
import { AdminCoupons }     from './pages/admin/Coupons.jsx'
import { AdminSettings }    from './pages/admin/Settings.jsx'

function Analytics() {
  const location = useLocation()
  useEffect(() => { trackPageView(location.pathname) }, [location.pathname])
  return null
}

function StorefrontLayout() {
  return (
    <>
      <ScrollRestoration />
      <Analytics />
      <Navbar />
      <CartDrawer />
      <Outlet />
      <Footer />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <StorefrontLayout />,
    children: [
      { path: '/',                  element: <Home />          },
      { path: '/products',          element: <Products />      },
      { path: '/products/:id',      element: <ProductDetail /> },
      { path: '/collections',       element: <Collections />   },
      { path: '/wishlist',          element: <Wishlist />      },
      { path: '/checkout',          element: <Checkout />      },
      { path: '/about',             element: <About />         },
      { path: '/contact',           element: <Contact />       },
      { path: '/account',           element: <Account />       },
      { path: '/privacy',           element: <PolicyPage pageKey="privacy" />  },
      { path: '/terms',             element: <PolicyPage pageKey="terms" />     },
      { path: '/refund',            element: <PolicyPage pageKey="refund" />    },
      { path: '/shipping',          element: <PolicyPage pageKey="shipping" />  },
    ],
  },
  { path: '/admin/login', element: <AdminLogin /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true,           element: <AdminDashboard />   },
      { path: 'product-views', element: <AdminProductViews /> },
      { path: 'homepage',      element: <AdminHomepage />    },
      { path: 'products',      element: <AdminProducts />    },
      { path: 'inventory',     element: <AdminInventory />   },
      { path: 'categories',    element: <AdminCategories />  },
      { path: 'collections',   element: <AdminCollections /> },
      { path: 'banners',       element: <AdminBanners />     },
      { path: 'videos',        element: <AdminVideos />      },
      { path: 'reviews',       element: <AdminReviews />     },
      { path: 'gallery',       element: <AdminGallery />     },
      { path: 'orders',        element: <AdminOrders />      },
      { path: 'reports',       element: <AdminReports />     },
      { path: 'coupons',       element: <AdminCoupons />     },
      { path: 'settings',      element: <AdminSettings />    },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
