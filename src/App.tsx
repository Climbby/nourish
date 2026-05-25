import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { AddMeal } from './pages/AddMeal'
import { MealDetail } from './pages/MealDetail'
import { EditMeal } from './pages/EditMeal'
import { Favourites } from './pages/Favourites'
import { History } from './pages/History'
import { AddProduct } from './pages/AddProduct'

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-sm mx-auto min-h-screen bg-nourish-bg">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/add" element={<AddMeal />} />
          <Route path="/meal/:id" element={<MealDetail />} />
          <Route path="/meal/:id/edit" element={<EditMeal />} />
          <Route path="/favourites" element={<Favourites />} />
          <Route path="/history" element={<History />} />
          <Route path="/add-product" element={<AddProduct />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
