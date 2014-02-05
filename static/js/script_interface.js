$(document).ready(function(){
	$.superbox.settings = {
		boxId: "", // Attribut id de l'élément "superbox"
		boxClasses: "superbox", // Classes de l'élément "superbox"
		overlayOpacity: .3, // Opacité du fond
		boxWidth: "600", // Largeur par défaut de la box
		boxHeight: "300", // Hauteur par défaut de la box
		loadTxt: "Loading...", // Texte de loading
		closeTxt: "Close", // Texte du bouton "Close"
		prevTxt: "Previous", // Texte du bouton "previous"
		nextTxt: "Next" // Texte du bouton "Next"
	};
	$.superbox();
});