export type SendParams = {
	to: string;
	artistId: string;
	artistName: string;
	subject: string;
	html: string;
	replyTo?: string;
};

export type SendResult = {
	id: string;
	status: "sent" | "suppressed";
};

export interface EmailService {
	send(params: SendParams): Promise<SendResult>;
	sendBatch(params: SendParams[]): Promise<SendResult[]>;
}
