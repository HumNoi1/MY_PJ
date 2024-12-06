import Chat from '@/components/chat';

export default function ChatPage({ params }) {
    return (
    <div>
        <Chat classId={params.classId} />
    </div>
    );
}