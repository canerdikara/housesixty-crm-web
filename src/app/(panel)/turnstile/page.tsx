import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader, Card } from "@/components/Page";
import { ui } from "@/components/ui";
import { readSession } from "@/lib/session";
import { TurnstileScanner } from "./TurnstileScanner";
import styles from "./turnstile.module.css";

export const metadata = { title: "Turnike simülatörü · House Sixty CRM" };
export const dynamic = "force-dynamic";

/**
 * A stand-in for the turnstile, so the reports have something to report.
 *
 * ## Why this exists
 *
 * Nothing calls `POST /access/qr/validate`. The member apps only call `/generate` — they
 * draw the code — and no caller for `/validate` exists in any of the four repos, because
 * the scanning side is the gate's own integration and it has not been built. So
 * `qr_tokens` has never held a used row, and «Anlık rapor» and «Günlük rapor» show
 * bookings and an em dash.
 *
 * This page is a camera pointed at a member's phone doing exactly what the gate will do.
 * It makes those two screens demonstrable today, and it is a working reference for
 * whoever wires the real reader: the request it sends is the request the gate should
 * send.
 *
 * ## ⚠️ It is a test tool, and it is not in the sidebar
 *
 * Deliberately. The ten sidebar entries are the designed screens (CRM.md §7.1) and this
 * is not one of them; putting it there would present a developer's harness as part of
 * the product. It is reached from «Anlık rapor», which is where somebody is standing
 * when they want the turnstile column to fill, and the banner below says what it is.
 *
 * ## The gate is the login, not the endpoint
 *
 * `/access/qr/validate` is `permitAll` and has to be — a turnstile carries no
 * credentials. So this page being behind the panel's login and Amplify's basic auth
 * controls who gets a *scanner*, not who can reach the endpoint. Anyone who can read a
 * member's QR can already post it with curl, which is true of the real gate too and is
 * why the token lives sixty seconds and can be used once.
 */
export default async function TurnstilePage() {
  const session = await readSession();
  if (!session) redirect("/login");

  return (
    <PageBody>
      <PageHeader
        title="Turnike simülatörü"
        subtitle={
          <>
            <Link href="/reports/live">Anlık rapor</Link> › Turnike simülatörü
          </>
        }
        actions={
          <Link className={`${ui.button} ${ui.buttonGhost}`} href="/reports/live">
            Anlık rapora dön
          </Link>
        }
      />

      <div className={styles.banner}>
        <strong>Bu bir test aracıdır.</strong> Gerçek turnike donanımı bağlanana kadar,
        üyenin uygulamadaki QR kodunu bu sayfadaki kamerayla okutarak giriş ve çıkış
        kaydı oluşturabilirsiniz. Okutulan her kod gerçek bir geçiş kaydı yazar ve «Anlık
        rapor» ile «Günlük rapor» ekranlarında görünür — yani burada yapılan okutmalar
        gerçek veridir, silinmez.
      </div>

      <Card>
        <TurnstileScanner />
      </Card>

      <Card>
        <h2 className={styles.helpTitle}>Gerçek turnikeyi bağlayacak kişi için</h2>
        <p className={styles.helpText}>
          Bu sayfanın yaptığı tek şey, okuduğu QR içeriğini aşağıdaki isteğe koymaktır.
          Donanım da aynısını göndermelidir:
        </p>
        <pre className={styles.code}>{`POST https://api.housesixty.com/api/v1/access/qr/validate
Content-Type: application/json

{
  "token": "<QR kodunun içeriği>",
  "entryPoint": "MAIN_GATE",   // veya SPA_ENTRANCE, GYM_ENTRANCE
  "direction": "ENTRY"          // veya EXIT
}`}</pre>
        <ul className={styles.helpList}>
          <li>
            <strong>Kimlik doğrulama gerekmez.</strong> Turnikenin kimlik bilgisi yoktur;
            güvenlik, kodun <strong>60 saniye</strong> geçerli olması ve{" "}
            <strong>yalnızca bir kez</strong> kullanılabilmesidir.
          </li>
          <li>
            <strong>`direction` gönderilmezse `ENTRY` varsayılır</strong>, yani mevcut bir
            entegrasyon değiştirilmeden çalışmaya devam eder. Ancak{" "}
            <strong>çıkış okutulmadığı sürece</strong> «Anlık rapor» içerideki kişi
            sayısını yalnızca dört saatlik üst sınırla düşürür.
          </li>
          <li>
            <strong>`entryPoint` okuyucunun kendi kimliğidir</strong>, üyenin telefonunun
            tahmini değil. Salon girişine okuyucu takıldığında `GYM_ENTRANCE` göndermesi
            yeterlidir; rapordaki «Salon» sütunu kendiliğinden dolar.
          </li>
        </ul>
      </Card>
    </PageBody>
  );
}
