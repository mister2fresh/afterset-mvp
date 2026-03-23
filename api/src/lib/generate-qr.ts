import QRCode from "qrcode";

export async function generateQrPng(slug: string): Promise<Buffer> {
	const url = `https://afterset.net/c/${slug}?v=q`;
	const buffer = await QRCode.toBuffer(url, {
		type: "png",
		width: 1200,
		margin: 2,
		errorCorrectionLevel: "H",
		color: { dark: "#000000", light: "#ffffff" },
	});
	return Buffer.from(buffer);
}
