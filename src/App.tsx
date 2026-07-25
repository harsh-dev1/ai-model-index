import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import IndexPage from './pages/IndexPage.tsx';
import ModelPage from './pages/ModelPage.tsx';
import ComparePage from './pages/ComparePage.tsx';
import TrendsPage from './pages/TrendsPage.tsx';
import MethodologyPage from './pages/MethodologyPage.tsx';
import { useIndex } from './lib/data.ts';

export default function App() {
  const { data, error, loading } = useIndex();

  return (
    // Real paths, not #/fragments, so a link to a model page is a link someone can read.
    // GitHub Pages has no server-side rewrite, so the deploy workflow copies index.html to
    // 404.html; the app then boots on any deep link and routes it client-side.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout sources={data?.meta.sources ?? []} />}>
          <Route index element={<IndexPage state={{ data, error, loading }} />} />
          <Route path="model/:slug" element={<ModelPage state={{ data, error, loading }} />} />
          <Route path="compare" element={<ComparePage state={{ data, error, loading }} />} />
          <Route path="trends" element={<TrendsPage state={{ data, error, loading }} />} />
          <Route path="methodology" element={<MethodologyPage state={{ data, error, loading }} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
