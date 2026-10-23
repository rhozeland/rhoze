import {createRoot} from 'react-dom/client';
import DiscoverDirectory from './create/DiscoverDirectory';
import './index.css';
const el=document.getElementById('discover-explorer-root');
if(el)createRoot(el).render(<DiscoverDirectory/>);
