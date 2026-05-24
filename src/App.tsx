import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { AddMeal } from './pages/AddMeal'
import { MealDetail } from './pages/MealDetail'

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-sm mx-auto min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/add" element={<AddMeal />} />
          <Route path="/meal/:id" element={<MealDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
