import {useState} from "react";
import {
    AlertDialog, AlertDialogAction,
    AlertDialogCancel,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog.tsx";
import {AlertDialogContent, AlertDialogDescription} from "@radix-ui/react-alert-dialog";


// ---------------------------------------------------------------------------
// Taiga #142
// Build the confirmation dialog (S)
// ---------------------------------------------------------------------------

export type LineItemSummary = {description: string, amount_cents: number, spent_on: string};

type Props = {
    item: LineItemSummary;
    onCancel: () => void;
    onConfirm: () => Promise<void>;
};

export default function CreateLineItemDialog({item, onCancel, onConfirm}, props: Props) {
    const [busy, setBusy] = useState(false);
    const [er, setEr] = useState("");
    const close = () => {if (busy) return; setEr(""); onCancel();};
    const confirm = async (e: React.MouseEvent) => {
        e.preventDefault();
        setBusy(true);
        setEr("");
        try {
            await onConfirm();
        } catch {setEr("This item could not be removed. Please try again or check your connection!");}
        finally {setBusy(false);}
    }

    return(
        <AlertDialog open={item} onOpenChange={(o)=> !o && close()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Did you want to remove this item/cost?</AlertDialogTitle>
                    <AlertDialogDescription></AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                    <AlertDialogAction disabled={busy} onClick={confirm}>
                        {busy ? "Removing cost from project..." : "Remove"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}