export const fixed7f = a => {
	return !a ? 0 : parseFloat(parseFloat(a).toFixed(7));
}

export const fixed3f = a => {
	return !a ? 0 : parseFloat(parseFloat(a).toFixed(3));
}
