import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-600-italic.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-600.css';
import './style.css';
import { creerCarte } from './carte/carte';
import { store } from './state';
import { creerPanneau } from './ui/panneau';

const { recentrer } = creerCarte(document.getElementById('carte')!, store);
creerPanneau(document.getElementById('panneau')!, store, { recentrer });
