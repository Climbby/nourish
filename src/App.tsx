import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { AddMeal } from './pages/AddMeal'
import { MealDetail } from './pages/MealDetail'
import { EditMeal } from './pages/EditMeal'
import { Favourites } from './pages/Favourites'
import { History } from './pages/History'
import { WeeklyPlan } from './pages/WeeklyPlan'
import { Profile } from './pages/Profile'
import { AddProduct } from './pages/AddProduct'
import { ProductDetail } from './pages/ProductDetail'
import { ReceiptScanPage } from './features/receipt/ReceiptScanPage'
import { UpdatePrompt } from './components/UpdatePrompt'
import { DefaultHomeRedirect } from './components/DefaultHomeRedirect'

export default function App() {
  return (
    <BrowserRouter>
      <UpdatePrompt />
      <div className="max-w-sm mx-auto min-h-screen bg-nourish-bg">
        <Routes>
          <Route path="/" element={<DefaultHomeRedirect />} />
          <Route path="/meals" element={<Home />} />
          <Route path="/add" element={<AddMeal />} />
          <Route path="/meal/:id" element={<MealDetail />} />
          <Route path="/meal/:id/edit" element={<EditMeal />} />
          <Route path="/favourites" element={<Favourites />} />
          <Route path="/history" element={<History />} />
          <Route path="/plan" element={<WeeklyPlan />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/add-product" element={<AddProduct />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/receipt" element={<ReceiptScanPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
