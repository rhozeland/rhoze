import {createRoot} from 'react-dom/client';
import DiscoverExplorer from './create/DiscoverExplorer';
import './index.css';
const el=document.getElementById('discover-explorer-root');
if(el)createRoot(el).render(<DiscoverExplorer/>);
