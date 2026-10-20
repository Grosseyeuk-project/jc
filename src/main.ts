import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-600-italic.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-600.css';
import './style.css';
import { creerActions, store } from './actions';
import { creerCarte } from './carte/carte';
import { creerFrise } from './ui/frise';
import { creerPanneau } from './ui/panneau';

const actions = creerActions(store);
const carte = creerCarte(document.getElementById('carte')!, store, actions);
creerFrise(document.getElementById('frise')!, store, actions);
creerPanneau(document.getElementById('panneau')!, store, actions, carte);
