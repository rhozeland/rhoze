import {useState} from "react";
import {
    AlertDialog, AlertDialogAction,
    AlertDialogCancel,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogContent,
    AlertDialogDescription
} from "@/components/ui/alert-dialog.tsx";
import {money} from "@/create/shared.tsx";


// ---------------------------------------------------------------------------
// Taiga #142
// Build the confirmation dialog (S)
// ---------------------------------------------------------------------------

export type LineItemSummary = {label: string, amount_cents: number, entry_date: string};

type Props = {
    item: LineItemSummary | null;
    onCancel: () => void;
    onConfirm: () => Promise<void>;
};

export default function DeleteLineItemDialog({item, onCancel, onConfirm}: Props) {
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
        <AlertDialog open={!!item} onOpenChange={(o)=> !o && close()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Did you want to remove this item/cost?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {item && <>"{item.label}": {money(item.amount_cents)}, {item.entry_date}<br/>
                        Item will be removed and your spent total will update. This cannot be undone.</>}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {er && <p role={"alert"} className={"rz-err"}>{er}</p>}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                    <AlertDialogAction disabled={busy} onClick={confirm}>
                        {busy ? "Removing cost..." : "Remove"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
