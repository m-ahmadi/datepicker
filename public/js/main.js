import comp1 from './comp1.js';
import comp2 from './comp2/comp2.js';

document.addEventListener('DOMContentLoaded', async function () {
	
	await comp1.init();
	comp2.init();
	
});