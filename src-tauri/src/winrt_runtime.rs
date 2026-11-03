use std::cell::RefCell;

use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
use windows::Win32::System::WinRT::{RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED};

thread_local! {
    static APARTMENT: RefCell<Option<Apartment>> = const { RefCell::new(None) };
}

struct Apartment {
    owns_initialization: bool,
}

impl Drop for Apartment {
    fn drop(&mut self) {
        if self.owns_initialization {
            unsafe { RoUninitialize() };
        }
    }
}

pub(crate) fn ensure_initialized() -> Result<(), String> {
    APARTMENT.with(|apartment| {
        if apartment.borrow().is_some() {
            return Ok(());
        }

        let owns_initialization = match unsafe { RoInitialize(RO_INIT_MULTITHREADED) } {
            Ok(()) => true,
            Err(error) if error.code() == RPC_E_CHANGED_MODE => false,
            Err(error) => {
                return Err(format!(
                    "Failed to initialize Windows Runtime: 0x{:08X}",
                    error.code().0 as u32
                ));
            }
        };
        *apartment.borrow_mut() = Some(Apartment {
            owns_initialization,
        });
        Ok(())
    })
}
