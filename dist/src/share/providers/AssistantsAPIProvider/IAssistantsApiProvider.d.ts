import { AssistantResponseDto } from '@/assistants/application/dtos/assistant-response.dto';
declare const secretKey: string;
interface IAssistantsAPIProvider {
    findAssistantById(id: string, headers: {
        'Content-Type': 'application/json';
        Authorization: `Bearer ${typeof secretKey}`;
    }): Promise<{
        status: number;
        data: AssistantResponseDto;
    }[]>;
}
export { IAssistantsAPIProvider };
